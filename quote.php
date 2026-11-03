<?php
/**
 * Quote request handler for the static site (LiteSpeed; PHP 7.4 or later).
 * Receives JSON from the contact form and emails it to the sales inbox.
 * Responses are JSON: {"ok":true} or {"ok":false,"error":"..."}.
 */
declare(strict_types=1);

const TO_ADDRESS = 'sales@digitallyshifted.com';
const FROM_ADDRESS = 'website@digitallyshifted.com';
const ALLOWED_HOSTS = ['digitallyshifted.com', 'www.digitallyshifted.com'];
const RATE_LIMIT = 5;          // requests
const RATE_WINDOW = 600;       // seconds

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method']);
}

// Same-origin only: the browser's Origin must match this host (or the canonical domain).
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
$selfHost = strtolower((string) preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
if ($originHost === '' || ($originHost !== $selfHost && !in_array($originHost, ALLOWED_HOSTS, true))) {
    respond(403, ['ok' => false, 'error' => 'origin']);
}

$raw = file_get_contents('php://input', false, null, 0, 20000);
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'error' => 'payload']);
}

/** Single-line field: trimmed, control characters (incl. CR/LF) removed, length-capped. */
function line(array $d, string $key, int $max): string
{
    $v = isset($d[$key]) && is_string($d[$key]) ? $d[$key] : '';
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

/** Multi-line field: keeps line breaks, strips other control characters. */
function text(array $d, string $key, int $max): string
{
    $v = isset($d[$key]) && is_string($d[$key]) ? $d[$key] : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $v) ?? '';
    return mb_substr(trim(str_replace("\r\n", "\n", $v)), 0, $max);
}

// Honeypot: people never see this field.
if (line($data, 'website', 200) !== '') {
    respond(200, ['ok' => true]);
}

// Timing: the form reports how long it was open. Bots that post directly send nothing, or post instantly.
// People who are that fast see the normal "try again" message and succeed on the next attempt.
$elapsed = isset($data['elapsed']) && is_numeric($data['elapsed']) ? (int) $data['elapsed'] : 0;
if ($elapsed < 1500) {
    respond(422, ['ok' => false, 'error' => 'timing']);
}

$name = line($data, 'name', 120);
$email = line($data, 'email', 200);
$phone = line($data, 'phone', 40);
$company = line($data, 'company', 160);
$service = line($data, 'service', 120);
$page = line($data, 'page', 200);
$message = text($data, 'message', 5000);

$errors = [];
if ($name === '') $errors[] = 'name';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'email';
if (mb_strlen($message) < 10) $errors[] = 'message';
if ($errors) {
    respond(422, ['ok' => false, 'error' => 'invalid', 'fields' => $errors]);
}

// Simple per-IP rate limit, stored in the system temp directory.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$bucket = sys_get_temp_dir() . '/ds-quote-' . hash('sha256', $ip);
$now = time();
$hits = [];
if (is_file($bucket)) {
    $hits = array_filter(array_map('intval', explode(',', (string) file_get_contents($bucket))), fn ($t) => $t > $now - RATE_WINDOW);
}
if (count($hits) >= RATE_LIMIT) {
    respond(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = $now;
file_put_contents($bucket, implode(',', $hits), LOCK_EX);

// reCAPTCHA v3 (optional, DIG-91 2026-11-03). Active only when BOTH are true:
//   - this build shipped its activation marker: recaptcha-active.php next to this file, written by
//     scripts/postbuild.mjs when the build was given a public site key (PUBLIC_RECAPTCHA_SITE_KEY,
//     src/lib/recaptcha.ts). A dormant build sends no token field; its submissions pass, like before.
//   - this host holds the secret, first found wins: getenv('RECAPTCHA_SECRET'), $_SERVER['RECAPTCHA_SECRET'],
//     or a recaptcha-secret.php next to this file that returns it: <?php return 'the-secret';
// The browser sends a token, or "unavailable" when it could not load reCAPTCHA (content blockers).
// RECAPTCHA_VERIFY_URL (env) overrides the Google endpoint, for tests.
function recaptcha_secret(): string
{
    $s = (string) (getenv('RECAPTCHA_SECRET') ?: '');
    if ($s === '') {
        $s = (string) ($_SERVER['RECAPTCHA_SECRET'] ?? '');
    }
    if ($s === '') {
        $f = __DIR__ . '/recaptcha-secret.php';
        if (is_file($f)) {
            $v = include $f;
            if (is_string($v)) {
                $s = $v;
            }
        }
    }
    return $s;
}

$secret = recaptcha_secret();
if ($secret !== '' && is_file(__DIR__ . '/recaptcha-active.php')) {
    $token = line($data, 'recaptcha', 2048);
    $answered = false;
    $verified = false;
    if ($token !== '' && $token !== 'unavailable') {
        $url = (string) (getenv('RECAPTCHA_VERIFY_URL') ?: 'https://www.google.com/recaptcha/api/siteverify');
        $ctx = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query(['secret' => $secret, 'response' => $token]),
            'timeout' => 5,
            'ignore_errors' => true,
        ]]);
        $r = json_decode((string) @file_get_contents($url, false, $ctx), true);
        if (is_array($r)) {
            $answered = true;
            $verified = ($r['success'] ?? false) === true
                && (float) ($r['score'] ?? 0) >= 0.5
                && (string) ($r['action'] ?? 'quote') === 'quote';
        }
    }
    // An active build always sends a token field. None, or "unavailable" (the browser could not load
    // reCAPTCHA, a content blocker say), does not verify — except when a real token was sent and Google
    // itself could not be reached: then the checks above stand, rather than take the form down with Google.
    $askedGoogle = $token !== '' && $token !== 'unavailable';
    $transportFailed = $askedGoogle && !$answered;
    if (!$verified && !$transportFailed) {
        respond(422, ['ok' => false, 'error' => 'recaptcha']);
    }
}

// A WhatsApp link to the visitor, from the number they gave: a local 0XX number becomes +27; anything that is not
// 9 to 15 digits gets no link.
$waDigits = preg_replace('/\D+/', '', $phone);
if (strpos($waDigits, '0') === 0 && strpos($waDigits, '00') !== 0) {
    $waDigits = '27' . substr($waDigits, 1);
} elseif (strpos($waDigits, '00') === 0) {
    $waDigits = substr($waDigits, 2);
}
$whatsapp = strlen($waDigits) >= 9 && strlen($waDigits) <= 15 ? 'https://wa.me/' . $waDigits : '';

$subject = 'Quote request: ' . ($service !== '' ? $service : 'General') . ' — ' . $name;
$body = implode("\n", [
    'New quote request from digitallyshifted.com',
    '',
    'Name:     ' . $name,
    'Email:    ' . $email,
    'Phone:    ' . ($phone !== '' ? $phone : '—'),
    ...($whatsapp !== '' ? ['WhatsApp: ' . $whatsapp] : []),
    'Company:  ' . ($company !== '' ? $company : '—'),
    'Service:  ' . ($service !== '' ? $service : 'Not sure yet'),
    'Page:     ' . ($page !== '' ? $page : '—'),
    // In South African time, as the team reads it (SAST, UTC+2 all year).
    'Sent:     ' . (new DateTimeImmutable('now', new DateTimeZone('Africa/Johannesburg')))->format('j F Y, H:i') . ' SAST',
    '',
    'Message:',
    $message,
    '',
]);

$headers = [
    'From' => 'Digitally Shifted website <' . FROM_ADDRESS . '>',
    'Reply-To' => $email,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Mailer' => 'digitallyshifted.com',
];

$sent = mail(
    TO_ADDRESS,
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    $body,
    $headers,
    '-f' . FROM_ADDRESS
);

if (!$sent) {
    respond(502, ['ok' => false, 'error' => 'mail']);
}
respond(200, ['ok' => true]);
