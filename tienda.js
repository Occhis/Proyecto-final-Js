let carrito = JSON.parse(localStorage.getItem("carrito")) ?? [];
let configuracion = null;

function ProductoCarrito(id, nombre, precio, cantidad, imagen) {
    this.id = id;
    this.nombre = nombre;
    this.precio = precio;
    this.cantidad = cantidad;
    this.imagen = imagen;
}

// Obtener configuración desde JSON
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
        mostrarNotificacion("Error al cargar la configuración de la tienda", "error");
        return null;
    }
}

// Obtener productos
async function obtenerProductos() {
  try {
    mostrarLoader(true);
    const res = await fetch("./productos.json");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    localStorage.setItem("productos", JSON.stringify(data));
    poblarCategorias();
    mostrarProductos(data);
    mostrarLoader(false);
  } catch (err) {
    console.error("Error al traer productos:", err);
    mostrarLoader(false);
    mostrarNotificacion("Error al cargar los productos. Por favor, intenta más tarde.", "error");
  }
}


function mostrarProductos(lista) {
  const contenedor = document.getElementById("productos");
  contenedor.innerHTML = "";

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = "<p>No se encontraron productos.</p>";
    return;
  }

  lista.forEach(producto => {
    const card = document.createElement("div");
    card.className = "evento-card";

    const nombre = producto.title || producto.name || "Sin nombre";
    const precio = producto.priceCents !== undefined
        ? Number(producto.priceCents) / 100
        : 0;
    const id = String(producto.id);
    let imagen = producto.image || producto.imagen || "products/default.jpg";

    card.innerHTML = `
      <img src="${imagen}" alt="${nombre}" class="evento-img">
      <div class="evento-content">
        <h3>${nombre}</h3>
        <div class="precio-container">
          <span class="precio">${configuracion?.tienda?.simboloMoneda || "$"}${precio.toFixed(2)}</span>
        </div>
        <button class="btn-comprar" data-id="${id}">Agregar al carrito</button>
      </div>
    `;

    contenedor.appendChild(card);
});

  // Asignar eventos a los botones
  document.querySelectorAll(".btn-comprar").forEach(btn => {
    btn.addEventListener("click", function() {
      agregarAlCarrito(this.getAttribute("data-id"));
    });
  });
}


function aplicarOfertas(producto) {
    if (!configuracion || !configuracion.cupones) return producto.price;
    
    // Ejemplo: aplicar descuento general a electrónicos
    if (producto.category === "electronics") {
        return producto.price * 0.9; // 10% descuento en electrónicos
    }
    
    return producto.price;
}

function agregarAlCarrito(id) {
  const productos = JSON.parse(localStorage.getItem("productos")) ?? [];
  const producto = productos.find(p => String(p.id) === String(id));

  if (producto) {
    let carrito = JSON.parse(localStorage.getItem("carrito")) ?? [];
    const existente = carrito.find(item => String(item.id) === String(producto.id));

    const nombre = producto.title || producto.name || "Sin nombre";
    const precio = producto.priceCents !== undefined
        ? Number(producto.priceCents) / 100
        : 0;
    const idStr = String(producto.id);

   
    let imagen = producto.image || producto.imagen || "products/default.jpg";
    
    if (existente) {
      existente.cantidad++;
    } else {
      carrito.push({
        id: idStr,
        nombre: nombre,
        precio: precio,
        imagen: imagen,
        cantidad: 1
      });
    }

    localStorage.setItem("carrito", JSON.stringify(carrito));
    window.carrito = carrito;
    mostrarNotificacion(`${nombre} agregado al carrito`, "success");
    actualizarContadorCarrito();
  }
}

function mostrarNotificacion(mensaje, tipo = "info") {
    // Crear elemento de notificación
    const notificacion = document.createElement("div");
    notificacion.className = `notificacion notificacion-${tipo}`;
    notificacion.innerHTML = `
        <span>${mensaje}</span>
        <button onclick="this.parentElement.remove()" class="cerrar-notificacion">×</button>
    `;
    
    // Agregar al body
    document.body.appendChild(notificacion);
    
    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        if (notificacion.parentElement) {
            notificacion.remove();
        }
    }, 4000);
}

function mostrarLoader(mostrar) {
    let loader = document.getElementById("loader");
    
    if (mostrar) {
        if (!loader) {
            loader = document.createElement("div");
            loader.id = "loader";
            loader.className = "loader";
            loader.innerHTML = `
                <div class="spinner"></div>
                <p>Cargando productos...</p>
            `;
            document.body.appendChild(loader);
        }
    } else {
        if (loader) {
            loader.remove();
        }
    }
}

function actualizarContadorCarrito() {
    const contador = document.getElementById("contador-carrito");
    const carrito = JSON.parse(localStorage.getItem("carrito")) ?? [];
    const cantidad = carrito.reduce((acc, item) => acc + item.cantidad, 0);

    if (cantidad > 0) {
        contador.textContent = cantidad;
        contador.style.display = "inline-flex";
    } else {
        contador.textContent = "0";
        contador.style.display = "none";
    }
}

// Inicializar aplicación
async function inicializarApp() {
    try {
        configuracion = await obtenerConfiguracion();
        if (configuracion) {
            // Actualizar título de la página si es necesario
            document.title = configuracion.tienda.nombre;
            
            // Actualizar header si existe
            const headerTitle = document.querySelector("header h1");
            if (headerTitle && headerTitle.textContent.trim() === "E-Commerce shopping") {
                headerTitle.textContent = configuracion.tienda.nombre;
            }
        }
        
        // Cargar productos
        await obtenerProductos();
        
        // Actualizar contador del carrito
        actualizarContadorCarrito();
        
    } catch (err) {
        console.error("Error al inicializar la aplicación:", err);
        mostrarNotificacion("Error al inicializar la aplicación", "error");
    }
}

// Filtrar productos
function filtrarProductos() {
    const texto = document.getElementById("input-busqueda").value.toLowerCase();
    const categoria = document.getElementById("filtro-categoria").value;
    const productos = JSON.parse(localStorage.getItem("productos")) ?? [];

    const filtrados = productos.filter(producto => {
        const nombre = (producto.title || producto.name || "").toLowerCase();
        const cat = (producto.category || "").toLowerCase();
        const coincideNombre = nombre.includes(texto);
        const coincideCategoria = !categoria || cat === categoria.toLowerCase();
        return coincideNombre && coincideCategoria;
    });

    mostrarProductos(filtrados);
}

function poblarCategorias() {
    const productos = JSON.parse(localStorage.getItem("productos")) ?? [];
    const select = document.getElementById("filtro-categoria");
    if (!select) return;

    // Extraer categorías únicas y ordenarlas alfabéticamente
    const categorias = Array.from(
        new Set(
            productos
                .map(p => p.category)
                .filter(cat => cat && cat.trim() !== "")
        )
    ).sort((a, b) => a.localeCompare(b, 'es', {sensitivity: 'base'}));

    // Limpiar y agregar opción "Todas"
    select.innerHTML = `<option value="">Todas las categorías</option>`;
    categorias.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`;
    });
}
// Eventos para buscar y filtrar

document.getElementById("input-busqueda").addEventListener("input", filtrarProductos);
document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos);


// Iniciar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", async () => {
  await inicializarApp(); // Cambiado para inicializar correctamente
});

