<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'comments.json';
if (!is_dir($dataDir)) { @mkdir($dataDir, 0755, true); }
if (!file_exists($dataFile)) { @file_put_contents($dataFile, "{}", LOCK_EX); }

function respond($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ulen($value) {
    if (function_exists('mb_strlen')) return mb_strlen($value, 'UTF-8');
    preg_match_all('/./us', $value, $matches);
    return count($matches[0]);
}

function usubstr_max($value, $max) {
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    $chars = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    return implode('', array_slice($chars ?: [], 0, $max));
}

function clean_text($value, $max) {
    $value = trim((string)$value);
    $value = preg_replace('/\s+/u', ' ', $value);
    if (ulen($value) > $max) $value = usubstr_max($value, $max);
    return $value;
}

function valid_article($article) {
    return preg_match('/^[a-z0-9-]{3,120}$/', $article) === 1;
}

function read_all_comments($file) {
    $raw = @file_get_contents($file);
    $decoded = json_decode($raw ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $article = clean_text($_GET['article'] ?? '', 120);
    if (!valid_article($article)) respond(['ok' => false, 'error' => 'Artículo inválido.'], 400);
    $all = read_all_comments($dataFile);
    $comments = $all[$article] ?? [];
    respond(['ok' => true, 'comments' => array_values($comments)]);
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) respond(['ok' => false, 'error' => 'Solicitud inválida.'], 400);

    // Honeypot: bots suelen completar este campo oculto.
    if (!empty($payload['website'])) respond(['ok' => true, 'comment' => null]);

    $article = clean_text($payload['article'] ?? '', 120);
    $name = clean_text($payload['name'] ?? '', 60);
    $text = clean_text($payload['text'] ?? '', 1200);

    if (!valid_article($article)) respond(['ok' => false, 'error' => 'Artículo inválido.'], 400);
    if (ulen($name) < 2) respond(['ok' => false, 'error' => 'Escribe tu nombre.'], 400);
    if (ulen($text) < 3) respond(['ok' => false, 'error' => 'El comentario es demasiado corto.'], 400);

    $fp = @fopen($dataFile, 'c+');
    if (!$fp) respond(['ok' => false, 'error' => 'No se pudo abrir el archivo de comentarios.'], 500);
    if (!flock($fp, LOCK_EX)) { fclose($fp); respond(['ok' => false, 'error' => 'No se pudo guardar el comentario.'], 500); }

    rewind($fp);
    $raw = stream_get_contents($fp);
    $all = json_decode($raw ?: '{}', true);
    if (!is_array($all)) $all = [];
    if (!isset($all[$article]) || !is_array($all[$article])) $all[$article] = [];

    $comment = [
        'id' => bin2hex(random_bytes(8)),
        'name' => $name,
        'text' => $text,
        'createdAt' => gmdate('c')
    ];
    array_unshift($all[$article], $comment);
    $all[$article] = array_slice($all[$article], 0, 200);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    respond(['ok' => true, 'comment' => $comment], 201);
}

respond(['ok' => false, 'error' => 'Método no permitido.'], 405);
