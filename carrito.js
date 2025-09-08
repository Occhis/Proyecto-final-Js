let carrito = JSON.parse(localStorage.getItem("carrito")) ?? [];
let configuracion = null;
let cuponAplicado = null;
let metodosPago = [];

async function obtenerConfiguracion() {
    try {
        const res = await fetch("./config.json");
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const config = await res.json();
        return config;
    } catch (err) {
        console.error("Error al cargar configuración:", err);
        return null;
    }
}

function mostrarCarrito() {
    const contenedor = document.getElementById("carrito");
    contenedor.innerHTML = "";

    if (carrito.length === 0) {
        contenedor.innerHTML = `
            <div class="carrito-vacio">
                <h3>🛒 Tu carrito está vacío</h3>
                <p>¡Agrega algunos productos para comenzar!</p>
                <a href="index.html" class="btn-volver">Ver Productos</a>
            </div>
        `;
        document.getElementById("total").textContent = "0.00";
        ocultarSeccionCheckout();
        return;
    }

    carrito.forEach(item => {
        const div = document.createElement("div");
        div.className = "carrito-item";
        div.innerHTML = `
            <img src="${item.imagen}" alt="${item.nombre}" class="carrito-img">
            <div class="item-info">
                <h4>${item.nombre}</h4>
                <div class="precio-info">
                    <p class="precio-unitario">Precio: ${configuracion?.tienda?.simboloMoneda || '$'}${item.precio.toFixed(2)}</p>
                    <p class="precio-subtotal">Subtotal: ${configuracion?.tienda?.simboloMoneda || '$'}${(item.precio * item.cantidad).toFixed(2)}</p>
                </div>
                <div class="cantidad-controls">
                    <button onclick="restarUno(${item.id})" class="btn-cantidad">-</button>
                    <span class="cantidad">Cantidad: ${item.cantidad}</span>
                    <button onclick="sumarUno(${item.id})" class="btn-cantidad">+</button>
                </div>
                <button onclick="eliminarProducto(${item.id})" class="btn-eliminar">🗑️ Eliminar</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    calcularTotal();
    mostrarSeccionCheckout();
}

function restarUno(id) {
    let productoEnCarrito = carrito.find(item => String(item.id) === String(id));
    if (productoEnCarrito) {
        if (productoEnCarrito.cantidad > 1) {
            productoEnCarrito.cantidad--;
        } else {
            carrito = carrito.filter(item => String(item.id) !== String(id));
        }
        guardarYMostrar();
    }
}

function sumarUno(id) {
    let productoEnCarrito = carrito.find(item => String(item.id) === String(id));
    if (productoEnCarrito) {
        productoEnCarrito.cantidad++;
        guardarYMostrar();
    }
}

function eliminarProducto(id) {
    const producto = carrito.find(item => String(item.id) === String(id));
    if (producto) {
        mostrarNotificacion(`${producto.nombre} eliminado del carrito`, "info");
        carrito = carrito.filter(item => String(item.id) !== String(id));
        guardarYMostrar();
    }
}

function calcularTotal() {
    if (!configuracion) return;

    const subtotal = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    document.getElementById("subtotal").textContent = subtotal.toFixed(2);

    let descuentoCupon = 0;
    let costoEnvio = configuracion.tienda.costoEnvio;

    if (cuponAplicado) {
        descuentoCupon = subtotal * (cuponAplicado.descuento || 0);
        if (cuponAplicado.envioGratis) costoEnvio = 0;
    }

    if (subtotal >= configuracion.tienda.envioGratis) {
        costoEnvio = 0;
    }

    const subtotalAfterCupon = subtotal - descuentoCupon;

    let descuentoMetodo = 0;
    const metodoSeleccionado = document.querySelector('input[name="metodoPago"]:checked');
    if (metodoSeleccionado) {
        const metodo = configuracion.metodosPago.find(m => m.id == metodoSeleccionado.value);
        if (metodo && metodo.descuento) {
            descuentoMetodo = subtotalAfterCupon * metodo.descuento;
        }
    }

    const subtotalAfterAllDiscounts = subtotalAfterCupon - descuentoMetodo;

    const impuestos = subtotalAfterAllDiscounts * configuracion.tienda.impuestos;
    const total = subtotalAfterAllDiscounts + impuestos + costoEnvio;

    document.getElementById("descuento").textContent = descuentoCupon.toFixed(2);
    const descuentoRow = document.querySelector(".descuento-row");
    if (descuentoRow) descuentoRow.style.display = descuentoCupon > 0 ? "flex" : "none";


    let descuentoMetodoRow = document.querySelector(".descuento-metodo-row");
    if (descuentoMetodo > 0) {
        if (!descuentoMetodoRow) {
            descuentoMetodoRow = document.createElement("div");
            descuentoMetodoRow.className = "linea-total descuento-metodo-row";
            descuentoMetodoRow.innerHTML = `
                <span>Descuento por método de pago:</span>
                <span class="descuento">-$<span id="descuento-metodo">0.00</span></span>
            `;
            const resumen = document.querySelector(".resumen-compra");
            const totalFinalLine = document.querySelector(".linea-total.total-final");
            if (resumen && totalFinalLine) {
                resumen.insertBefore(descuentoMetodoRow, totalFinalLine);
            } else if (resumen) {
                resumen.appendChild(descuentoMetodoRow);
            }
        }
        document.getElementById("descuento-metodo").textContent = descuentoMetodo.toFixed(2);
        descuentoMetodoRow.style.display = "flex";
    } else {
        if (descuentoMetodoRow) descuentoMetodoRow.remove();
    }

    document.getElementById("impuestos").textContent = impuestos.toFixed(2);
    const envioTexto = costoEnvio === 0 ? "GRATIS" : `${configuracion.tienda.simboloMoneda}${costoEnvio.toFixed(2)}`;
    const envioSpan = document.getElementById("envio");
    if (envioSpan) envioSpan.textContent = envioTexto;


    document.getElementById("total").textContent = total.toFixed(2);
}

function aplicarCupon() {
    const inputCupon = document.getElementById("input-cupon");
    const codigoCupon = inputCupon.value.trim().toUpperCase();
    
    if (!codigoCupon) {
        mostrarNotificacion("Por favor ingresa un código de cupón", "warning");
        return;
    }
    
    const cupon = configuracion.cupones.find(c => c.codigo === codigoCupon && c.activo);
    
    if (!cupon) {
        mostrarNotificacion("Cupón inválido o expirado", "error");
        inputCupon.value = "";
        return;
    }
    
    const subtotal = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    if (cupon.minCompra && subtotal < cupon.minCompra) {
        mostrarNotificacion(`Este cupón requiere una compra mínima de ${configuracion.tienda.simboloMoneda}${cupon.minCompra}`, "warning");
        return;
    }
    
    cuponAplicado = cupon;
    inputCupon.value = "";
    mostrarNotificacion(`¡Cupón aplicado! ${cupon.descripcion}`, "success");
    
    // Deshabilitar input de cupón (mostrar aplicado)
    document.getElementById("seccion-cupon").innerHTML = `
        <div class="cupon-aplicado">
            <span>✅ Cupón aplicado: ${cupon.codigo}</span>
            <button onclick="removerCupon()" class="btn-remover-cupon">Remover</button>
        </div>
    `;
    
    calcularTotal();
}

function removerCupon() {
    cuponAplicado = null;
    document.getElementById("seccion-cupon").innerHTML = `
        <div class="cupon-input">
            <input type="text" id="input-cupon" placeholder="Código de cupón">
            <button onclick="aplicarCupon()" class="btn-aplicar-cupon">Aplicar</button>
        </div>
    `;
    mostrarNotificacion("Cupón removido", "info");
    calcularTotal();
}

function mostrarSeccionCheckout() {
    const checkoutSection = document.getElementById("checkout-section");
    if (!checkoutSection) return;
    
    checkoutSection.style.display = "block";
    
    // Mostrar métodos de pago
    const metodosContainer = document.getElementById("metodos-pago");
    if (metodosContainer && configuracion.metodosPago) {
        metodosContainer.innerHTML = configuracion.metodosPago
            .filter(metodo => metodo.activo)
            .map(metodo => `
                <label class="metodo-pago">
                    <input type="radio" name="metodoPago" value="${metodo.id}">
                    <div class="metodo-info">
                        <span class="metodo-icono">${metodo.icono}</span>
                        <div>
                            <strong>${metodo.nombre}</strong>
                            <p>${metodo.descripcion}</p>
                        </div>
                    </div>
                </label>
            `).join("");
        
        // Agregar listener (solo una vez) para recalcular total al cambiar método
        if (!metodosContainer.dataset.listenerAttached) {
            metodosContainer.addEventListener("change", (e) => {
                if (e.target && e.target.name === "metodoPago") {
                    calcularTotal();
                }
            });
            metodosContainer.dataset.listenerAttached = "true";
        }
    }
    
    // Pre-completar datos del usuario
    if (configuracion.usuario) {
        const usuario = configuracion.usuario;
        document.getElementById("nombre").value = usuario.nombre;
        document.getElementById("email").value = usuario.email;
        document.getElementById("telefono").value = usuario.telefono;
        document.getElementById("direccion").value = usuario.direccion.calle;
        document.getElementById("ciudad").value = usuario.direccion.ciudad;
        document.getElementById("codigo-postal").value = usuario.direccion.codigoPostal;
    }


// recalcular para que el total se muestre correctamente al abrir checkout
calcularTotal();
}
function validarFormularioCheckout() {
    // Obtén los valores de los campos
    const nombre = document.getElementById("nombre").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const ciudad = document.getElementById("ciudad").value.trim();
    const codigoPostal = document.getElementById("codigo-postal").value.trim();

    // Validaciones básicas
    if (!nombre) {
        mostrarNotificacion("El nombre es obligatorio", "warning");
        return false;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/.test(nombre)) {
        mostrarNotificacion("El nombre contiene caracteres inválidos", "warning");
        return false;
    }
    if (!email) {
        mostrarNotificacion("El email es obligatorio", "warning");
        return false;
    }
    if (!/^[\w\.-]+@[\w\.-]+\.\w{2,}$/.test(email)) {
        mostrarNotificacion("El email no es válido", "warning");
        return false;
    }
    if (!telefono) {
        mostrarNotificacion("El teléfono es obligatorio", "warning");
        return false;
    }
    if (!/^[\d\s\-\+()]{7,20}$/.test(telefono)) {
        mostrarNotificacion("El teléfono contiene caracteres inválidos", "warning");
        return false;
    }
    if (!direccion) {
        mostrarNotificacion("La dirección es obligatoria", "warning");
        return false;
    }
    if (!ciudad) {
        mostrarNotificacion("La ciudad es obligatoria", "warning");
        return false;
    }
    if (!codigoPostal) {
        mostrarNotificacion("El código postal es obligatorio", "warning");
        return false;
    }
    if (!/^[a-zA-Z0-9\s\-]{3,10}$/.test(codigoPostal)) {
        mostrarNotificacion("El código postal no es válido", "warning");
        return false;
    }
    return true;
}

function ocultarSeccionCheckout() {
    const checkoutSection = document.getElementById("checkout-section");
    if (checkoutSection) {
        checkoutSection.style.display = "none";
    }
}

function finalizarCompra() {
    if (!validarFormularioCheckout()) return;
    // Validar método de pago
    const metodoSeleccionado = document.querySelector('input[name="metodoPago"]:checked');
    if (!metodoSeleccionado) {
        mostrarNotificacion("Por favor selecciona un método de pago", "warning");
        return;
    }
    
    const metodo = configuracion.metodosPago.find(m => m.id == metodoSeleccionado.value);
    const totalText = document.getElementById("total").textContent;
    const total = parseFloat(totalText) || 0;
    
    // Simular proceso de compra
    mostrarNotificacion("Procesando compra...", "info");
    
    setTimeout(() => {
        // Guardar en historial
        const compra = {
            id: Date.now(),
            fecha: new Date().toLocaleString(),
            productos: [...carrito],
            total: total,
            metodoPago: metodo.nombre,
            cupon: cuponAplicado?.codigo || null
        };
        
        let historial = JSON.parse(localStorage.getItem("historialCompras")) || [];
        historial.unshift(compra);
        localStorage.setItem("historialCompras", JSON.stringify(historial));
        
        // Limpiar carrito
        carrito = [];
        cuponAplicado = null;
        localStorage.removeItem("carrito");
        
        // Mostrar mensaje de éxito
        mostrarCompraExitosa(compra);
        
    }, 2000);
}

function mostrarCompraExitosa(compra) {
    const contenedor = document.getElementById("carrito");
    contenedor.innerHTML = `
        <div class="compra-exitosa">
            <div class="success-icon">✅</div>
            <h2>¡Compra realizada con éxito!</h2>
            <div class="compra-detalles">
                <p><strong>Número de orden:</strong> #${compra.id}</p>
                <p><strong>Total pagado:</strong> ${configuracion.tienda.simboloMoneda}${compra.total.toFixed(2)}</p>
                <p><strong>Método de pago:</strong> ${compra.metodoPago}</p>
                <p><strong>Fecha:</strong> ${compra.fecha}</p>
            </div>
            <p class="mensaje-agradecimiento">
                Gracias por tu compra. Recibirás un email de confirmación en breve.
            </p>
            <div class="acciones-finales">
                <a href="index.html" class="btn-continuar">Continuar Comprando</a>
                <button onclick="location.reload()" class="btn-nueva-compra">Nueva Compra</button>
            </div>
        </div>
    `;
    
    // Ocultar secciones innecesarias
    const totalContainer = document.querySelector(".total-container");
    if (totalContainer) totalContainer.style.display = "none";
    ocultarSeccionCheckout();
}

function guardarYMostrar() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
    mostrarCarrito();
}

function mostrarNotificacion(mensaje, tipo = "info") {
    const notificacion = document.createElement("div");
    notificacion.className = `notificacion notificacion-${tipo}`;
    notificacion.innerHTML = `
        <span>${mensaje}</span>
        <button onclick="this.parentElement.remove()" class="cerrar-notificacion">×</button>
    `;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        if (notificacion.parentElement) {
            notificacion.remove();
        }
    }, 4000);
}

/* ---------- SweetAlert para vaciar carrito (reemplaza confirm) ---------- */
const vaciarBtn = document.getElementById("vaciarCarrito");
if (vaciarBtn) {
    vaciarBtn.addEventListener("click", () => {
        if (carrito.length === 0) return;

        if (typeof Swal !== "undefined") {
            Swal.fire({
                title: "¿Vaciar carrito?",
                text: "Se eliminarán todos los productos del carrito.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ff4d4d",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, vaciar",
                cancelButtonText: "Cancelar"
            }).then((result) => {
                if (result.isConfirmed) {
                    carrito = [];
                    cuponAplicado = null;
                    guardarYMostrar();
                    mostrarNotificacion("Carrito vaciado", "info");
                }
            });
        } else {
            // fallback si SweetAlert no está cargado
            if (confirm("¿Estás seguro de que quieres vaciar el carrito?")) {
                carrito = [];
                cuponAplicado = null;
                guardarYMostrar();
                mostrarNotificacion("Carrito vaciado", "info");
            }
        }
    });
}

// Inicializar carrito
async function inicializarCarrito() {
    try {
        configuracion = await obtenerConfiguracion();
        mostrarCarrito();
    } catch (err) {
        console.error("Error al inicializar carrito:", err);
        mostrarNotificacion("Error al cargar la configuración", "error");
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarCarrito);
