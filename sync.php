<?php
/**
 * Bruiloftsplanner – samen plannen.
 *
 * Bewaart een gedeelde planning onder een geheime koppelcode, zodat beide partners
 * op hun eigen apparaat dezelfde planning zien. Geen database nodig: elke planning is
 * één JSON-bestand in de map ./data (die map wordt automatisch aangemaakt en afgeschermd).
 *
 * Privacy:
 *  - Bestandsnamen zijn een hash van de code; de code zelf staat nergens op de server.
 *  - Planningen die 18 maanden niet gewijzigd zijn, worden automatisch verwijderd.
 *  - Een bruidspaar kan de gedeelde planning zelf verwijderen vanuit de app.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

const DATA_DIR       = __DIR__ . '/data';
const MAX_BYTES      = 1048576;                 // max. 1 MB per planning
const RETENTION_DAYS = 548;                     // ~18 maanden zonder wijziging
const LIMIT_CREATE   = 20;                      // nieuwe koppelcodes per IP per uur
const LIMIT_MISS     = 30;                      // onjuiste codes per IP per uur
const ALPHABET       = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // zonder 0/O/1/I
const CODE_LENGTH    = 12;                      // 60 bits, getoond als XXXX-XXXX-XXXX

function out(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0700, true) && !is_dir(DATA_DIR)) {
        out(500, ['error' => 'storage']);
    }
    $ht = DATA_DIR . '/.htaccess';
    if (!file_exists($ht)) {
        file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    if (!file_exists(DATA_DIR . '/index.html')) {
        file_put_contents(DATA_DIR . '/index.html', '');
    }
}

function normalize_code($raw): ?string
{
    if (!is_string($raw)) return null;
    $c = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', $raw) ?? '');
    return preg_match('/^[' . ALPHABET . ']{' . CODE_LENGTH . '}$/', $c) ? $c : null;
}

function new_code(): string
{
    $c = '';
    for ($i = 0; $i < CODE_LENGTH; $i++) $c .= ALPHABET[random_int(0, strlen(ALPHABET) - 1)];
    return $c;
}

function path_for(string $code): string
{
    return DATA_DIR . '/' . hash('sha256', 'bruiloftsplanner:' . $code) . '.json';
}

/** Eenvoudige limiet per IP-adres (gehasht) per uur. Geeft false als de limiet bereikt is. */
function within_limit(string $kind, int $limit): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'onbekend';
    $file = DATA_DIR . '/rl-' . hash('sha256', $kind . '|' . $ip) . '-' . gmdate('YmdH') . '.txt';
    $fh = fopen($file, 'c+');
    if (!$fh) return true;
    flock($fh, LOCK_EX);
    $n = (int) stream_get_contents($fh) + 1;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) $n);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $n <= $limit;
}

/** Ruimt af en toe verlopen planningen en oude limiet-bestanden op. */
function cleanup(): void
{
    if (random_int(1, 50) !== 1) return;
    $now = time();
    foreach (glob(DATA_DIR . '/*.json') ?: [] as $f) {
        if ($now - (int) filemtime($f) > RETENTION_DAYS * 86400) @unlink($f);
    }
    foreach (glob(DATA_DIR . '/rl-*.txt') ?: [] as $f) {
        if ($now - (int) filemtime($f) > 7200) @unlink($f);
    }
}

function read_record($fh): ?array
{
    rewind($fh);
    $rec = json_decode((string) stream_get_contents($fh), true);
    return is_array($rec) && isset($rec['version']) ? $rec : null;
}

function write_record($fh, array $rec): void
{
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($rec, JSON_UNESCAPED_UNICODE));
    fflush($fh);
}

ensure_data_dir();
cleanup();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action === 'ping') out(200, ['ok' => true]);
    if ($action !== 'get') out(400, ['error' => 'action']);

    $code = normalize_code($_GET['code'] ?? null);
    $file = $code ? path_for($code) : null;
    if (!$file || !is_file($file)) {
        if (!within_limit('miss', LIMIT_MISS)) out(429, ['error' => 'too_many']);
        out(404, ['error' => 'not_found']);
    }
    $fh = fopen($file, 'r');
    flock($fh, LOCK_SH);
    $rec = read_record($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    if (!$rec) out(500, ['error' => 'corrupt']);
    out(200, ['version' => $rec['version'], 'updated' => $rec['updated'] ?? null, 'data' => $rec['data']]);
}

if ($method !== 'POST') out(405, ['error' => 'method']);

$raw = file_get_contents('php://input', false, null, 0, MAX_BYTES + 1);
if ($raw === false || strlen($raw) > MAX_BYTES) out(413, ['error' => 'too_large']);
$body = json_decode($raw, true);
if (!is_array($body)) out(400, ['error' => 'json']);
$action = $body['action'] ?? '';

if ($action === 'create') {
    if (!is_array($body['data'] ?? null)) out(400, ['error' => 'data']);
    if (!within_limit('create', LIMIT_CREATE)) out(429, ['error' => 'too_many']);
    for ($try = 0; $try < 5; $try++) {
        $code = new_code();
        $fh = @fopen(path_for($code), 'x'); // 'x' faalt als het bestand al bestaat
        if ($fh) {
            flock($fh, LOCK_EX);
            write_record($fh, ['version' => 1, 'updated' => gmdate('c'), 'data' => $body['data']]);
            flock($fh, LOCK_UN);
            fclose($fh);
            out(201, ['code' => $code, 'version' => 1]);
        }
    }
    out(500, ['error' => 'storage']);
}

$code = normalize_code($body['code'] ?? null);
$file = $code ? path_for($code) : null;
if (!$file || !is_file($file)) {
    if (!within_limit('miss', LIMIT_MISS)) out(429, ['error' => 'too_many']);
    out(404, ['error' => 'not_found']);
}

if ($action === 'save') {
    if (!is_array($body['data'] ?? null) || !is_int($body['version'] ?? null)) out(400, ['error' => 'data']);
    $fh = fopen($file, 'c+');
    flock($fh, LOCK_EX);
    $rec = read_record($fh);
    if (!$rec) { flock($fh, LOCK_UN); fclose($fh); out(500, ['error' => 'corrupt']); }
    if ($rec['version'] !== $body['version']) {
        // Iemand anders heeft intussen opgeslagen: stuur de nieuwste versie terug om samen te voegen.
        flock($fh, LOCK_UN);
        fclose($fh);
        out(409, ['error' => 'conflict', 'version' => $rec['version'], 'data' => $rec['data']]);
    }
    $version = $rec['version'] + 1;
    write_record($fh, ['version' => $version, 'updated' => gmdate('c'), 'data' => $body['data']]);
    flock($fh, LOCK_UN);
    fclose($fh);
    out(200, ['version' => $version]);
}

if ($action === 'delete') {
    @unlink($file);
    out(200, ['ok' => true]);
}

out(400, ['error' => 'action']);
