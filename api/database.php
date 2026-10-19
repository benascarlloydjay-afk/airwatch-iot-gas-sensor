<?php
declare(strict_types=1);

function database(): PDO
{
    $localConfigPath = __DIR__ . '/database.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) {
        $localConfig = [];
    }

    $host = getenv('AIRWATCH_DB_HOST') ?: ($localConfig['host'] ?? '127.0.0.1');
    $port = getenv('AIRWATCH_DB_PORT') ?: ($localConfig['port'] ?? '3306');
    $name = getenv('AIRWATCH_DB_NAME') ?: ($localConfig['name'] ?? 'airwatch_db');
    $user = getenv('AIRWATCH_DB_USER') ?: ($localConfig['user'] ?? 'root');
    $password = getenv('AIRWATCH_DB_PASSWORD') ?: ($localConfig['password'] ?? '');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    return new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
