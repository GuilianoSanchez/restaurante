import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost/restaurante/backend/api';

function DashboardTrabajador({ user, onLogout }) {
  const [selectedMenuOption, setSelectedMenuOption] = useState(null);
  const [menus, setMenus] = useState([]);
  const [pedidoActual, setPedidoActual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  
  // Fecha de hoy
  const hoy = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const showToast = (message, type = 'info', ms = 3000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), ms);
  };

  const cargarDatos = async () => {
    if (!user?.empresa_id || !user?.id) {
      showToast('Error: Usuario sin empresa asignada', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Cargar menús de la empresa
      await cargarMenus(user.empresa_id);
      
      // Cargar pedido actual del trabajador
      await cargarPedidoActual(user.id);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      showToast('Error al cargar información', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarMenus = async (empresa_id) => {
    try {
      const res = await fetch(`${API_BASE}/menus.php?empresa_id=${empresa_id}`);
      const txt = await res.text();
      const data = JSON.parse(txt.replace(/^\uFEFF/, '').trim());
      
      if (data.menus && Array.isArray(data.menus)) {
        setMenus(data.menus);
      } else {
        setMenus([]);
      }
    } catch (err) {
      console.error('Error cargar menús:', err);
      setMenus([]);
    }
  };

  const cargarPedidoActual = async (trabajador_id) => {
    try {
      const res = await fetch(`${API_BASE}/crear_pedido.php?trabajador_id=${trabajador_id}&fecha=${hoy}`);
      const data = await res.json();
      
      if (data.tiene_pedido && data.pedido) {
        setPedidoActual(data.pedido);
        
        // Pre-seleccionar la opción del pedido actual
        setSelectedMenuOption({
          menuId: data.pedido.menu_id,
          opcionId: data.pedido.opcion_id
        });
      } else {
        setPedidoActual(null);
        setSelectedMenuOption(null);
      }
    } catch (err) {
      console.error('Error cargar pedido actual:', err);
      setPedidoActual(null);
    }
  };

  const confirmarPedido = async () => {
    if (!selectedMenuOption) {
      showToast('Selecciona una opción primero', 'warning');
      return;
    }

    if (!user?.id) {
      showToast('Error: Usuario no identificado', 'error');
      return;
    }

    setSubmitting(true);
    
    try {
      const res = await fetch(`${API_BASE}/crear_pedido.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabajador_id: user.id,
          opcion_id: selectedMenuOption.opcionId,
          fecha: hoy
        })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const accion = data.accion === 'creado' ? 'realizado' : 'actualizado';
        showToast(`✅ Pedido ${accion} correctamente`, 'success', 4000);
        
        // Recargar pedido actual
        await cargarPedidoActual(user.id);
      } else {
        showToast(data.error || 'Error al guardar pedido', 'error');
      }
    } catch (err) {
      console.error('Error al confirmar pedido:', err);
      showToast('Error de conexión al guardar pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelarPedido = async () => {
    if (!pedidoActual) return;

    if (!confirm('¿Estás seguro de cancelar tu pedido del día?')) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/crear_pedido.php`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabajador_id: user.id,
          fecha: hoy
        })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        showToast('Pedido cancelado', 'success');
        setPedidoActual(null);
        setSelectedMenuOption(null);
      } else {
        showToast(data.error || 'Error al cancelar', 'error');
      }
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
      showToast('Error de conexión', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando menús...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 max-w-sm">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' :
            toast.type === 'warning' ? 'bg-yellow-600' :
            'bg-blue-600'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">🍔 Comer Bien</h1>
              <p className="text-sm text-orange-100">{user?.nombre}</p>
            </div>
            <button 
              onClick={onLogout} 
              className="bg-white text-orange-900 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Alerta de horario */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
          <p className="font-semibold text-yellow-800">⏰ Recuerda: Los pedidos cierran hoy a las 17:00</p>
          <p className="text-sm text-yellow-700">Fecha: {hoy}</p>
        </div>

        {/* Pedido actual */}
        {pedidoActual && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-green-800 mb-1">✅ Pedido Confirmado</p>
                <p className="text-sm text-green-700">
                  <strong>{pedidoActual.menu_nombre}</strong> - {pedidoActual.opcion_nombre}
                </p>
                {pedidoActual.precio && (
                  <p className="text-sm text-green-600 mt-1">Precio: ${pedidoActual.precio.toFixed(2)}</p>
                )}
              </div>
              <button
                onClick={cancelarPedido}
                disabled={submitting}
                className="text-sm text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold mb-4">
          {pedidoActual ? '✏️ Cambiar mi pedido:' : '🍽️ Selecciona tu menú del día:'}
        </h2>

        {/* Listado de menús */}
        {menus.length > 0 ? (
          <div className="space-y-6">
            {menus.map(menu => (
              <div key={menu.id} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="font-bold text-lg mb-2">{menu.nombre}</h3>
                {menu.descripcion && (
                  <p className="text-sm text-gray-600 mb-4">{menu.descripcion}</p>
                )}

                <div className="space-y-3">
                  {(menu.opciones || []).map((op) => {
                    const isSelected = selectedMenuOption && 
                                      selectedMenuOption.menuId === menu.id && 
                                      selectedMenuOption.opcionId === op.opcion_id;
                    
                    return (
                      <div
                        key={op.opcion_id}
                        onClick={() => setSelectedMenuOption({ 
                          menuId: menu.id, 
                          opcionId: op.opcion_id 
                        })}
                        className={`cursor-pointer p-4 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">
                              Opción {String.fromCharCode(64 + op.idx)}: {op.nombre}
                            </p>
                            {op.descripcion && (
                              <p className="text-sm text-gray-600 mt-1">{op.descripcion}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {op.precio !== null && op.precio !== undefined ? (
                              <p className="font-bold text-orange-600">${op.precio.toFixed(2)}</p>
                            ) : (
                              <p className="text-gray-400 text-sm">Sin precio</p>
                            )}
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="mt-3 text-center">
                            <span className="inline-block bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              ✓ Seleccionado
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-500 text-lg">📭 No hay menús publicados para hoy</p>
            <p className="text-gray-400 text-sm mt-2">Contacta con tu supervisor</p>
          </div>
        )}

        {/* Botón confirmar */}
        {menus.length > 0 && (
          <button
            onClick={confirmarPedido}
            disabled={!selectedMenuOption || submitting}
            className="w-full mt-6 bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Guardando...
              </span>
            ) : selectedMenuOption ? (
              pedidoActual ? '💾 Actualizar mi Pedido' : '✓ Confirmar mi Pedido'
            ) : (
              '⚠️ Selecciona una opción primero'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default DashboardTrabajador;