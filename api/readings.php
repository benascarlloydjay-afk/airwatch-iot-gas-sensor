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

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function database(): PDO
{
    $host = getenv('AIRWATCH_DB_HOST') ?: '127.0.0.1';
    $port = getenv('AIRWATCH_DB_PORT') ?: '3306';
    $name = getenv('AIRWATCH_DB_NAME') ?: 'airwatch_db';
    $user = getenv('AIRWATCH_DB_USER') ?: 'root';
    $password = getenv('AIRWATCH_DB_PASSWORD') ?: '';
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    return new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function numericInput(array $input, string $key): float
{
    if (!isset($input[$key]) || !is_numeric($input[$key])) {
        respond(422, ['error' => "The {$key} value is invalid."]);
    }

    $value = (float)$input[$key];
    if (!is_finite($value)) {
        respond(422, ['error' => "The {$key} value is invalid."]);
    }

    return $value;
}

$userId = filter_var($_SESSION['user_id'] ?? null, FILTER_VALIDATE_INT);
if (!$userId || $userId < 1) {
    respond(401, ['error' => 'Sign in to access saved readings.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = database();

    if ($method === 'GET') {
        $requestedPage = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
        $page = max(1, (int)($requestedPage ?: 1));
        $search = trim((string)($_GET['q'] ?? ''));
        $search = substr($search, 0, 100);
        $sort = (string)($_GET['sort'] ?? 'newest');
        $sortOrders = [
            'newest' => 'r.recorded_at DESC, r.id DESC',
            'oldest' => 'r.recorded_at ASC, r.id ASC',
            'alerts' => 'CASE WHEN (r.gas_alert = 1 OR r.temperature >= 45 OR r.humidity >= 70) THEN 1 ELSE 0 END DESC, r.recorded_at DESC, r.id DESC',
            'temperature' => 'r.temperature DESC, r.recorded_at DESC, r.id DESC',
            'humidity' => 'r.humidity DESC, r.recorded_at DESC, r.id DESC',
            'gas' => 'r.gas_adc DESC, r.recorded_at DESC, r.id DESC',
        ];
        $orderBy = $sortOrders[$sort] ?? $sortOrders['newest'];
        // All signed-in accounts can view the shared feed. user_id remains
        // attached to each row so its submitting account is identifiable.
        $where = '1 = 1';
        $parameters = [];

        if ($search !== '') {
            $where .= " AND (
                CAST(r.id AS CHAR) LIKE :search_id
                OR DATE_FORMAT(r.recorded_at, '%Y-%m-%d %H:%i:%s') LIKE :search_iso_date
                OR DATE_FORMAT(r.recorded_at, '%m/%d/%Y') LIKE :search_us_date
                OR DATE_FORMAT(r.recorded_at, '%d/%m/%Y') LIKE :search_eu_date
                OR CAST(r.temperature AS CHAR) LIKE :search_temperature
                OR CAST(r.humidity AS CHAR) LIKE :search_humidity
                OR CAST(r.gas_adc AS CHAR) LIKE :search_gas
                OR CAST(r.gas_threshold AS CHAR) LIKE :search_threshold
                OR u.email LIKE :search_email
                OR CASE
                    WHEN r.gas_alert = 1 OR r.temperature >= 45 OR r.humidity >= 70
                    THEN 'alert'
                    ELSE 'normal'
                END LIKE :search_status
            )";
            $term = '%' . $search . '%';
            foreach ([
                'search_id',
                'search_iso_date',
                'search_us_date',
                'search_eu_date',
                'search_temperature',
                'search_humidity',
                'search_gas',
                'search_threshold',
                'search_email',
                'search_status',
            ] as $parameter) {
                $parameters[$parameter] = $term;
            }
        }

        $totalQuery = $pdo->prepare(
            "SELECT COUNT(*)
             FROM sensor_readings r
             INNER JOIN users u ON u.id = r.user_id
             WHERE {$where}"
        );
        $totalQuery->execute($parameters);
        $total = (int)$totalQuery->fetchColumn();
        $pages = max(1, (int)ceil($total / 10));
        $page = min($page, $pages);
        $offset = ($page - 1) * 10;
        $query = $pdo->prepare(
            'SELECT r.id, r.user_id, u.email, r.temperature, r.humidity,
                    r.gas_adc, r.gas_threshold, r.gas_alert, r.recorded_at
             FROM sensor_readings r
             INNER JOIN users u ON u.id = r.user_id
             WHERE ' . $where . '
             ORDER BY ' . $orderBy . '
             LIMIT 10 OFFSET ' . $offset
        );
        $query->execute($parameters);
        $readings = $query->fetchAll();

        foreach ($readings as &$reading) {
            $reading['id'] = (int)$reading['id'];
            $reading['user_id'] = (int)$reading['user_id'];
            $reading['temperature'] = (float)$reading['temperature'];
            $reading['humidity'] = (float)$reading['humidity'];
            $reading['gas_adc'] = (int)$reading['gas_adc'];
            $reading['gas_threshold'] = (int)$reading['gas_threshold'];
            $reading['gas_alert'] = (bool)$reading['gas_alert'];
        }
        unset($reading);

        respond(200, [
            'readings' => $readings,
            'page' => $page,
            'pages' => $pages,
            'total' => $total,
        ]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        respond(405, ['error' => 'Method not allowed.']);
    }

    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input)) {
        respond(400, ['error' => 'Invalid request body.']);
    }
    if (
        !isset($_SESSION['csrf_token'], $input['csrf_token']) ||
        !hash_equals($_SESSION['csrf_token'], (string)$input['csrf_token'])
    ) {
        respond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
    }

    $temperature = numericInput($input, 'temperature');
    $humidity = numericInput($input, 'humidity');
    $gasAdc = numericInput($input, 'gas_adc');
    $gasThreshold = numericInput($input, 'gas_threshold');

    if ($temperature < -10 || $temperature > 80) {
        respond(422, ['error' => 'Temperature must be between -10 and 80 °C.']);
    }
    if ($humidity < 0 || $humidity > 100) {
        respond(422, ['error' => 'Humidity must be between 0 and 100%.']);
    }
    if ($gasAdc < 0 || $gasAdc > 1023 || floor($gasAdc) !== $gasAdc) {
        respond(422, ['error' => 'The gas ADC value must be an integer from 0 to 1023.']);
    }
    if ($gasThreshold < 0 || $gasThreshold > 1023 || floor($gasThreshold) !== $gasThreshold) {
        respond(422, ['error' => 'The gas threshold must be an integer from 0 to 1023.']);
    }

    $insert = $pdo->prepare(
        'INSERT INTO sensor_readings
         (user_id, temperature, humidity, gas_adc, gas_threshold, gas_alert)
         VALUES (:user_id, :temperature, :humidity, :gas_adc, :gas_threshold, :gas_alert)'
    );
    $insert->execute([
        'user_id' => $userId,
        'temperature' => $temperature,
        'humidity' => $humidity,
        'gas_adc' => (int)$gasAdc,
        'gas_threshold' => (int)$gasThreshold,
        'gas_alert' => $gasAdc >= $gasThreshold ? 1 : 0,
    ]);

    $query = $pdo->prepare(
        'SELECT r.id, r.user_id, u.email, r.temperature, r.humidity,
                r.gas_adc, r.gas_threshold, r.gas_alert, r.recorded_at
         FROM sensor_readings r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.id = :id AND r.user_id = :user_id'
    );
    $query->execute(['id' => (int)$pdo->lastInsertId(), 'user_id' => $userId]);
    $reading = $query->fetch();
    $reading['id'] = (int)$reading['id'];
    $reading['user_id'] = (int)$reading['user_id'];
    $reading['temperature'] = (float)$reading['temperature'];
    $reading['humidity'] = (float)$reading['humidity'];
    $reading['gas_adc'] = (int)$reading['gas_adc'];
    $reading['gas_threshold'] = (int)$reading['gas_threshold'];
    $reading['gas_alert'] = (bool)$reading['gas_alert'];

    respond(201, ['reading' => $reading]);
} catch (Throwable $exception) {
    error_log('Sensor readings API error: ' . $exception->getMessage());
    respond(500, ['error' => 'Saved readings are unavailable. Check the XAMPP database setup.']);
}
