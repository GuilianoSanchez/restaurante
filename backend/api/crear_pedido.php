<?php
/**
 * API para gestionar pedidos de trabajadores
 * Permite crear, consultar y cancelar pedidos
 */

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

require_once __DIR__ . '/../db.php';

function send_json($code, $data) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Parsear body
$raw = file_get_contents("php://input");
$input = json_decode($raw, true) ?? [];

$method = $_SERVER['REQUEST_METHOD'];

// ========================================
// GET - Consultar pedido del trabajador para una fecha
// ========================================
if ($method === 'GET') {
    $trabajador_id = isset($_GET['trabajador_id']) ? intval($_GET['trabajador_id']) : 0;
    $fecha = $_GET['fecha'] ?? date('Y-m-d'); // Hoy por defecto

    if (!$trabajador_id) {
        send_json(400, ['error' => 'trabajador_id es requerido']);
    }

    // Buscar pedido del trabajador para la fecha
    $stmt = $conn->prepare("
        SELECT 
            p.id,
            p.fecha,
            p.trabajador_id,
            p.opcion_id,
            mo.nombre AS opcion_nombre,
            mo.descripcion AS opcion_descripcion,
            mo.menu_id,
            m.nombre AS menu_nombre,
            m.descripcion AS menu_descripcion,
            mp.precio
        FROM pedidos p
        JOIN menu_opciones mo ON p.opcion_id = mo.id
        JOIN menus m ON mo.menu_id = m.id
        LEFT JOIN menu_precios mp ON mp.menu_opcion_id = mo.id
        WHERE p.trabajador_id = ? AND p.fecha = ?
        LIMIT 1
    ");
    
    $stmt->bind_param("is", $trabajador_id, $fecha);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $pedido = $result->fetch_assoc();
        $stmt->close();
        $conn->close();
        send_json(200, [
            'tiene_pedido' => true,
            'pedido' => [
                'id' => (int)$pedido['id'],
                'fecha' => $pedido['fecha'],
                'trabajador_id' => (int)$pedido['trabajador_id'],
                'opcion_id' => (int)$pedido['opcion_id'],
                'opcion_nombre' => $pedido['opcion_nombre'],
                'opcion_descripcion' => $pedido['opcion_descripcion'],
                'menu_id' => (int)$pedido['menu_id'],
                'menu_nombre' => $pedido['menu_nombre'],
                'menu_descripcion' => $pedido['menu_descripcion'],
                'precio' => $pedido['precio'] ? (float)$pedido['precio'] : null
            ]
        ]);
    } else {
        $stmt->close();
        $conn->close();
        send_json(200, [
            'tiene_pedido' => false,
            'pedido' => null
        ]);
    }
}

// ========================================
// POST - Crear o reemplazar pedido del día
// ========================================
if ($method === 'POST') {
    $trabajador_id = isset($input['trabajador_id']) ? intval($input['trabajador_id']) : 0;
    $opcion_id = isset($input['opcion_id']) ? intval($input['opcion_id']) : 0;
    $fecha = $input['fecha'] ?? date('Y-m-d');

    // Validaciones
    if (!$trabajador_id || !$opcion_id) {
        send_json(400, ['error' => 'trabajador_id y opcion_id son requeridos']);
    }

    // Verificar que el trabajador existe
    $stmt = $conn->prepare("SELECT id, nombre, empresa_id FROM usuarios WHERE id = ? AND perfil = 'trabajador'");
    $stmt->bind_param("i", $trabajador_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        send_json(404, ['error' => 'Trabajador no encontrado']);
    }
    
    $trabajador = $result->fetch_assoc();
    $stmt->close();

    // Verificar que la opción existe y obtener el menú
    $stmt = $conn->prepare("
        SELECT mo.id, mo.menu_id, m.nombre AS menu_nombre, mo.nombre AS opcion_nombre
        FROM menu_opciones mo
        JOIN menus m ON mo.menu_id = m.id
        WHERE mo.id = ?
    ");
    $stmt->bind_param("i", $opcion_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        send_json(404, ['error' => 'Opción de menú no encontrada']);
    }
    
    $opcion = $result->fetch_assoc();
    $stmt->close();

    // Verificar si ya tiene pedido para esta fecha
    $stmt = $conn->prepare("SELECT id FROM pedidos WHERE trabajador_id = ? AND fecha = ?");
    $stmt->bind_param("is", $trabajador_id, $fecha);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        // Ya tiene pedido - ACTUALIZAR
        $pedido_existente = $result->fetch_assoc();
        $pedido_id = $pedido_existente['id'];
        $stmt->close();

        $stmt = $conn->prepare("UPDATE pedidos SET opcion_id = ? WHERE id = ?");
        $stmt->bind_param("ii", $opcion_id, $pedido_id);
        
        if ($stmt->execute()) {
            $stmt->close();
            $conn->close();
            send_json(200, [
                'ok' => true,
                'mensaje' => 'Pedido actualizado correctamente',
                'pedido_id' => $pedido_id,
                'accion' => 'actualizado',
                'detalles' => [
                    'menu' => $opcion['menu_nombre'],
                    'opcion' => $opcion['opcion_nombre']
                ]
            ]);
        } else {
            $error = $stmt->error;
            $stmt->close();
            $conn->close();
            send_json(500, ['error' => 'Error al actualizar pedido: ' . $error]);
        }
    } else {
        // No tiene pedido - CREAR NUEVO
        $stmt->close();

        $stmt = $conn->prepare("INSERT INTO pedidos (trabajador_id, opcion_id, fecha) VALUES (?, ?, ?)");
        $stmt->bind_param("iis", $trabajador_id, $opcion_id, $fecha);
        
        if ($stmt->execute()) {
            $pedido_id = $conn->insert_id;
            $stmt->close();
            $conn->close();
            send_json(201, [
                'ok' => true,
                'mensaje' => 'Pedido creado correctamente',
                'pedido_id' => $pedido_id,
                'accion' => 'creado',
                'detalles' => [
                    'menu' => $opcion['menu_nombre'],
                    'opcion' => $opcion['opcion_nombre']
                ]
            ]);
        } else {
            $error = $stmt->error;
            $stmt->close();
            $conn->close();
            send_json(500, ['error' => 'Error al crear pedido: ' . $error]);
        }
    }
}

// ========================================
// DELETE - Cancelar pedido del día
// ========================================
if ($method === 'DELETE') {
    $trabajador_id = isset($input['trabajador_id']) ? intval($input['trabajador_id']) : 0;
    $fecha = $input['fecha'] ?? date('Y-m-d');

    if (!$trabajador_id) {
        send_json(400, ['error' => 'trabajador_id es requerido']);
    }

    // Eliminar pedido del trabajador para la fecha
    $stmt = $conn->prepare("DELETE FROM pedidos WHERE trabajador_id = ? AND fecha = ?");
    $stmt->bind_param("is", $trabajador_id, $fecha);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            $stmt->close();
            $conn->close();
            send_json(200, [
                'ok' => true,
                'mensaje' => 'Pedido cancelado correctamente'
            ]);
        } else {
            $stmt->close();
            $conn->close();
            send_json(404, ['error' => 'No se encontró pedido para cancelar']);
        }
    } else {
        $error = $stmt->error;
        $stmt->close();
        $conn->close();
        send_json(500, ['error' => 'Error al cancelar pedido: ' . $error]);
    }
}

$conn->close();
send_json(405, ['error' => 'Método no permitido']);