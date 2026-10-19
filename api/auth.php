<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
require_once __DIR__ . '/database.php';

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    if (isset($_SESSION['user_id'], $_SESSION['email'])) {
        respond(200, ['authenticated' => true, 'email' => $_SESSION['email'], 'csrf_token' => $_SESSION['csrf_token']]);
    }
    respond(200, ['authenticated' => false, 'csrf_token' => $_SESSION['csrf_token']]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed.']);
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input)) {
    respond(400, ['error' => 'Invalid request body.']);
}
if (!isset($_SESSION['csrf_token']) || !isset($input['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$input['csrf_token'])) {
    respond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
}

$action = $input['action'] ?? '';
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
    respond(200, ['ok' => true]);
}

if (!in_array($action, ['register', 'login'], true)) {
    respond(400, ['error' => 'Unknown action.']);
}

$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    respond(422, ['error' => 'Enter a valid email address.']);
}
if ($password === '' || strlen($password) > 4096) {
    respond(422, ['error' => 'Enter a valid password.']);
}

try {
    $pdo = database();
    if ($action === 'register') {
        if (strlen($password) < 8) {
            respond(422, ['error' => 'Use a password with at least 8 characters.']);
        }
        $insert = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (:email, :password_hash)');
        try {
            $insert->execute([
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                respond(409, ['error' => 'An account with that email already exists.']);
            }
            throw $exception;
        }
        $userId = (int)$pdo->lastInsertId();
    } else {
        $query = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = :email LIMIT 1');
        $query->execute(['email' => $email]);
        $user = $query->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(401, ['error' => 'Email or password is incorrect.']);
        }
        $userId = (int)$user['id'];
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $update = $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
            $update->execute([
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $userId,
            ]);
        }
    }

    session_regenerate_id(true);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['user_id'] = $userId;
    $_SESSION['email'] = $email;
    respond(200, ['ok' => true, 'email' => $email, 'csrf_token' => $_SESSION['csrf_token']]);
} catch (Throwable $exception) {
    error_log('Airwatch authentication error: ' . $exception->getMessage());
    respond(500, ['error' => 'The account service is unavailable. Check the XAMPP database setup.']);
}
