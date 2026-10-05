import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";

// ---------- Estilos base ----------
const T = {
  bg: "#F4F3EE",
  paper: "#FFFFFF",
  ink: "#22261F",
  muted: "#6E7268",
  line: "#E2E0D8",
  green: "#2E5E4E",
  greenSoft: "#E3EDE8",
  amber: "#B47B1E",
  amberSoft: "#F6EDDA",
  red: "#A8402F",
  redSoft: "#F5E4E0",
};

const fontLink = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Public+Sans:wght@400;500;600;700&display=swap');`;

const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    isNaN(n) ? 0 : n
  );

const hoy = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const CATEGORIAS_SUGERIDAS = [
  "Cocina",
  "Decoración",
  "Textiles",
  "Organización",
  "Baño",
  "Electrodomésticos",
  "Muebles",
  "Otros",
];

export default function BazarApp() {
  const [tab, setTab] = useState("inventario");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // ---------- Persistencia ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("bazar-datos");
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setProducts(data.products || []);
          setSales(data.sales || []);
        }
      } catch (e) {
        // sin datos previos, empezamos vacío
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(
          "bazar-datos",
          JSON.stringify({ products, sales })
        );
      } catch (e) {
        console.error("No se pudo guardar", e);
      }
    })();
  }, [products, sales, loaded]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // ---------- Formularios ----------
  const emptyProd = {
    codigo: "",
    nombre: "",
    categoria: "",
    precio: "",
    stock: "1",
  };
  const [prodForm, setProdForm] = useState(emptyProd);
  const [editId, setEditId] = useState(null);

  const emptySale = { productId: "", cantidad: "1", precio: "", fecha: hoy(), nota: "" };
  const [saleForm, setSaleForm] = useState(emptySale);

  const [busqueda, setBusqueda] = useState("");

  // ---------- Inventario ----------
  const guardarProducto = () => {
    const { codigo, nombre, categoria, precio, stock } = prodForm;
    if (!codigo.trim() || !nombre.trim()) {
      notify("El código y el nombre son obligatorios");
      return;
    }
    if (
      editId === null &&
      products.some((p) => p.codigo.toLowerCase() === codigo.trim().toLowerCase())
    ) {
      notify("Ya existe un producto con ese código");
      return;
    }
    const nuevo = {
      id: editId ?? Date.now(),
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      categoria: categoria.trim() || "Sin categoría",
      precio: parseFloat(precio) || 0,
      stock: parseInt(stock) || 0,
    };
    if (editId !== null) {
      setProducts(products.map((p) => (p.id === editId ? nuevo : p)));
      notify("Producto actualizado");
    } else {
      setProducts([...products, nuevo]);
      notify("Producto agregado al inventario");
    }
    setProdForm(emptyProd);
    setEditId(null);
  };

  const editarProducto = (p) => {
    setProdForm({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: String(p.precio),
      stock: String(p.stock),
    });
    setEditId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarProducto = (id) => {
    setProducts(products.filter((p) => p.id !== id));
    notify("Producto eliminado");
  };

  // ---------- Ventas ----------
  const registrarVenta = () => {
    const prod = products.find((p) => String(p.id) === String(saleForm.productId));
    if (!prod) {
      notify("Selecciona un producto");
      return;
    }
    const cantidad = parseInt(saleForm.cantidad) || 0;
    if (cantidad <= 0) {
      notify("La cantidad debe ser mayor a 0");
      return;
    }
    if (cantidad > prod.stock) {
      notify(`Solo quedan ${prod.stock} unidades de ${prod.nombre}`);
      return;
    }
    const precioUnit =
      saleForm.precio !== "" ? parseFloat(saleForm.precio) : prod.precio;
    const venta = {
      id: Date.now(),
      fecha: saleForm.fecha || hoy(),
      codigo: prod.codigo,
      nombre: prod.nombre,
      categoria: prod.categoria,
      cantidad,
      precioUnit,
      precioLista: prod.precio,
      total: precioUnit * cantidad,
      nota: saleForm.nota.trim(),
    };
    setSales([venta, ...sales]);
    setProducts(
      products.map((p) =>
        p.id === prod.id ? { ...p, stock: p.stock - cantidad } : p
      )
    );
    setSaleForm({ ...emptySale, fecha: saleForm.fecha });
    notify(`Venta registrada: ${money(venta.total)}`);
  };

  const eliminarVenta = (id) => {
    const v = sales.find((s) => s.id === id);
    if (v) {
      // devolver stock
      setProducts(
        products.map((p) =>
          p.codigo === v.codigo ? { ...p, stock: p.stock + v.cantidad } : p
        )
      );
    }
    setSales(sales.filter((s) => s.id !== id));
    notify("Venta eliminada y stock devuelto");
  };

  // ---------- Resumen ----------
  const resumen = useMemo(() => {
    const ingresos = sales.reduce((a, s) => a + s.total, 0);
    const unidades = sales.reduce((a, s) => a + s.cantidad, 0);
    const stockRestante = products.reduce((a, p) => a + p.stock, 0);
    const ingresoPotencial = products.reduce((a, p) => a + p.precio * p.stock, 0);
    const descuentos = sales.reduce(
      (a, s) => a + Math.max(0, (s.precioLista ?? s.precioUnit) - s.precioUnit) * s.cantidad,
      0
    );

    const porCategoria = {};
    sales.forEach((s) => {
      if (!porCategoria[s.categoria])
        porCategoria[s.categoria] = { ingresos: 0, unidades: 0 };
      porCategoria[s.categoria].ingresos += s.total;
      porCategoria[s.categoria].unidades += s.cantidad;
    });

    const porProducto = {};
    sales.forEach((s) => {
      if (!porProducto[s.codigo])
        porProducto[s.codigo] = { nombre: s.nombre, unidades: 0, ingresos: 0 };
      porProducto[s.codigo].unidades += s.cantidad;
      porProducto[s.codigo].ingresos += s.total;
    });
    const top = Object.entries(porProducto)
      .sort((a, b) => b[1].ingresos - a[1].ingresos)
      .slice(0, 5);

    const agotados = products.filter((p) => p.stock === 0);

    return {
      ingresos,
      unidades,
      stockRestante,
      ingresoPotencial,
      descuentos,
      porCategoria,
      top,
      agotados,
    };
  }, [sales, products]);

  // ---------- Excel ----------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    const invRows = products.map((p) => ({
      Código: p.codigo,
      Producto: p.nombre,
      Categoría: p.categoria,
      "Precio de venta": p.precio,
      "Stock actual": p.stock,
      Estado: p.stock === 0 ? "Vendido / agotado" : "Disponible",
    }));
    const wsInv = XLSX.utils.json_to_sheet(invRows);
    wsInv["!cols"] = [
      { wch: 12 },
      { wch: 32 },
      { wch: 16 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsInv, "Inventario");

    const salesRows = [...sales]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((s) => ({
        Fecha: s.fecha,
        Código: s.codigo,
        Producto: s.nombre,
        Categoría: s.categoria,
        Cantidad: s.cantidad,
        "Precio unitario": s.precioUnit,
        "Total venta": s.total,
        Nota: s.nota,
      }));
    const wsVen = XLSX.utils.json_to_sheet(salesRows);
    wsVen["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 32 },
      { wch: 16 },
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVen, "Ventas");

    const resRows = [
      { Concepto: "Ingresos totales", Valor: resumen.ingresos },
      { Concepto: "Unidades vendidas", Valor: resumen.unidades },
      { Concepto: "Unidades restantes en inventario", Valor: resumen.stockRestante },
      {
        Concepto: "Ingreso potencial de lo que queda",
        Valor: resumen.ingresoPotencial,
      },
      { Concepto: "Total dado en descuentos", Valor: resumen.descuentos },
      {},
      { Concepto: "— Ingresos por categoría —", Valor: "" },
      ...Object.entries(resumen.porCategoria).map(([cat, d]) => ({
        Concepto: `${cat} (${d.unidades} uds)`,
        Valor: d.ingresos,
      })),
    ];
    const wsRes = XLSX.utils.json_to_sheet(resRows);
    wsRes["!cols"] = [{ wch: 38 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");

    XLSX.writeFile(wb, `bazar_${hoy()}.xlsx`);
    notify("Excel descargado");
  };

  // ---------- UI helpers ----------
  const input = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${T.line}`,
    borderRadius: 8,
    fontSize: 15,
    fontFamily: "'Public Sans', sans-serif",
    color: T.ink,
    background: "#FDFDFB",
    boxSizing: "border-box",
    outline: "none",
  };
  const label = {
    fontSize: 12,
    fontWeight: 600,
    color: T.muted,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 4,
    display: "block",
  };
  const btnPrimary = {
    background: T.green,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Public Sans', sans-serif",
  };
  const card = {
    background: T.paper,
    border: `1px solid ${T.line}`,
    borderRadius: 12,
    padding: 20,
  };

  const productosFiltrados = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  const categoriasExistentes = [
    ...new Set([...CATEGORIAS_SUGERIDAS, ...products.map((p) => p.categoria)]),
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'Public Sans', sans-serif",
        color: T.ink,
      }}
    >
      <style>{fontLink}</style>

      {/* Header */}
      <div
        style={{
          background: T.green,
          color: "#fff",
          padding: "24px 20px 0",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Mi Bazar
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>
            Inventario y ventas · artículos del hogar
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
            {[
              ["inventario", "Inventario"],
              ["ventas", "Ventas"],
              ["resumen", "Resumen"],
            ].map(([key, name]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "10px 10px 0 0",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Public Sans', sans-serif",
                  background: tab === key ? T.bg : "rgba(255,255,255,0.12)",
                  color: tab === key ? T.green : "#fff",
                }}
              >
                {name}
              </button>
            ))}
            <button
              onClick={exportarExcel}
              style={{
                marginLeft: "auto",
                padding: "10px 18px",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: "10px 10px 0 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
                color: "#fff",
                fontFamily: "'Public Sans', sans-serif",
              }}
            >
              ⬇ Excel
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* ============ INVENTARIO ============ */}
        {tab === "inventario" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={card}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 19,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {editId !== null ? "Editar artículo" : "Agregar artículo"}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <label style={label}>Código</label>
                  <input
                    style={input}
                    placeholder="P-001"
                    value={prodForm.codigo}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, codigo: e.target.value })
                    }
                  />
                </div>
                <div style={{ gridColumn: "span 2", minWidth: 200 }}>
                  <label style={label}>Nombre del artículo</label>
                  <input
                    style={input}
                    placeholder="Juego de tazas de cerámica"
                    value={prodForm.nombre}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, nombre: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={label}>Categoría</label>
                  <input
                    style={input}
                    list="cats"
                    placeholder="Cocina"
                    value={prodForm.categoria}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, categoria: e.target.value })
                    }
                  />
                  <datalist id="cats">
                    {categoriasExistentes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label style={label}>Precio venta ($)</label>
                  <input
                    style={input}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="90"
                    value={prodForm.precio}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, precio: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label style={label}>Cantidad (uds)</label>
                  <input
                    style={input}
                    type="number"
                    min="0"
                    value={prodForm.stock}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, stock: e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button style={btnPrimary} onClick={guardarProducto}>
                  {editId !== null ? "Guardar cambios" : "Agregar al inventario"}
                </button>
                {editId !== null && (
                  <button
                    style={{
                      ...btnPrimary,
                      background: "transparent",
                      color: T.muted,
                      border: `1px solid ${T.line}`,
                    }}
                    onClick={() => {
                      setProdForm(emptyProd);
                      setEditId(null);
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de productos */}
            <div style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 19,
                    fontWeight: 600,
                  }}
                >
                  Artículos ({products.length})
                </div>
                <input
                  style={{ ...input, maxWidth: 260 }}
                  placeholder="Buscar por nombre, código o categoría…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              {productosFiltrados.length === 0 ? (
                <div
                  style={{
                    padding: "36px 0",
                    textAlign: "center",
                    color: T.muted,
                    fontSize: 15,
                  }}
                >
                  {products.length === 0
                    ? "Tu inventario está vacío. Agrega tu primer artículo arriba."
                    : "Ningún artículo coincide con la búsqueda."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "Código",
                          "Artículo",
                          "Categoría",
                          "Precio",
                          "Disponibles",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              borderBottom: `2px solid ${T.line}`,
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: T.muted,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productosFiltrados.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>
                            {p.codigo}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            {p.nombre}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            <span
                              style={{
                                background: T.greenSoft,
                                color: T.green,
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {p.categoria}
                            </span>
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>
                            {money(p.precio)}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            {p.stock === 0 ? (
                              <span style={{ background: T.redSoft, color: T.red, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                                Vendido
                              </span>
                            ) : (
                              p.stock
                            )}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>
                            <button
                              onClick={() => editarProducto(p)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: T.green, fontWeight: 600, fontSize: 13, marginRight: 10, fontFamily: "'Public Sans', sans-serif" }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => eliminarProducto(p.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: T.red, fontWeight: 600, fontSize: 13, fontFamily: "'Public Sans', sans-serif" }}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ VENTAS ============ */}
        {tab === "ventas" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={card}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 19,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                Registrar venta
              </div>
              {products.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 15 }}>
                  Primero agrega artículos en la pestaña Inventario.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div style={{ gridColumn: "span 2", minWidth: 220 }}>
                      <label style={label}>Artículo</label>
                      <select
                        style={{ ...input, cursor: "pointer" }}
                        value={saleForm.productId}
                        onChange={(e) => {
                          const prod = products.find(
                            (p) => String(p.id) === e.target.value
                          );
                          setSaleForm({
                            ...saleForm,
                            productId: e.target.value,
                            precio: prod ? String(prod.precio) : "",
                          });
                        }}
                      >
                        <option value="">— Selecciona —</option>
                        {products
                          .filter((p) => p.stock > 0)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.codigo} · {p.nombre} ({p.stock} disp.)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Cantidad</label>
                      <input
                        style={input}
                        type="number"
                        min="1"
                        value={saleForm.cantidad}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, cantidad: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label style={label}>Precio final ($)</label>
                      <input
                        style={input}
                        type="number"
                        min="0"
                        step="0.5"
                        value={saleForm.precio}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, precio: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label style={label}>Fecha</label>
                      <input
                        style={input}
                        type="date"
                        value={saleForm.fecha}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, fecha: e.target.value })
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "span 2", minWidth: 200 }}>
                      <label style={label}>Nota (opcional)</label>
                      <input
                        style={input}
                        placeholder="Cliente, regateo, apartado, etc."
                        value={saleForm.nota}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, nota: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  {saleForm.productId && saleForm.precio !== "" && (
                    <div style={{ marginTop: 10, fontSize: 14, color: T.muted }}>
                      Total de esta venta:{" "}
                      <b style={{ color: T.green, fontSize: 16 }}>
                        {money(
                          (parseFloat(saleForm.precio) || 0) *
                            (parseInt(saleForm.cantidad) || 0)
                        )}
                      </b>
                    </div>
                  )}
                  <button
                    style={{ ...btnPrimary, marginTop: 16 }}
                    onClick={registrarVenta}
                  >
                    Registrar venta
                  </button>
                </>
              )}
            </div>

            <div style={card}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 19,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                Historial ({sales.length} ventas · {money(resumen.ingresos)})
              </div>
              {sales.length === 0 ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: T.muted, fontSize: 15 }}>
                  Aún no has registrado ventas.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        {["Fecha", "Artículo", "Cant.", "P. unit.", "Total", ""].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              borderBottom: `2px solid ${T.line}`,
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: T.muted,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{s.fecha}</td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            {s.nombre}
                            {s.nota && (
                              <div style={{ fontSize: 12, color: T.muted }}>{s.nota}</div>
                            )}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>{s.cantidad}</td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            {money(s.precioUnit)}
                            {s.precioLista != null && s.precioUnit < s.precioLista && (
                              <div style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>
                                lista: {money(s.precioLista)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}`, fontWeight: 700 }}>{money(s.total)}</td>
                          <td style={{ padding: "10px", borderBottom: `1px solid ${T.line}` }}>
                            <button
                              onClick={() => eliminarVenta(s.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: T.red, fontWeight: 600, fontSize: 13, fontFamily: "'Public Sans', sans-serif" }}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ RESUMEN ============ */}
        {tab === "resumen" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              {[
                ["Ingresos totales", money(resumen.ingresos), T.green],
                ["Unidades vendidas", resumen.unidades, T.ink],
                ["Unidades restantes", resumen.stockRestante, T.ink],
                ["Si vendes todo lo que queda", money(resumen.ingresoPotencial), T.amber],
              ].map(([t2, v, color]) => (
                <div key={t2} style={{ ...card, padding: 18 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, fontWeight: 600 }}>
                    {t2}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color, marginTop: 6 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 12 }}>
                Ingresos por categoría
              </div>
              {Object.keys(resumen.porCategoria).length === 0 ? (
                <div style={{ color: T.muted, fontSize: 15 }}>Sin ventas aún.</div>
              ) : (
                Object.entries(resumen.porCategoria)
                  .sort((a, b) => b[1].ingresos - a[1].ingresos)
                  .map(([cat, d]) => {
                    const pct =
                      resumen.ingresos > 0
                        ? (d.ingresos / resumen.ingresos) * 100
                        : 0;
                    return (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>
                            {cat}{" "}
                            <span style={{ color: T.muted, fontWeight: 400 }}>
                              · {d.unidades} uds
                            </span>
                          </span>
                          <span style={{ fontWeight: 700 }}>{money(d.ingresos)}</span>
                        </div>
                        <div style={{ height: 8, background: T.line, borderRadius: 999 }}>
                          <div
                            style={{
                              height: 8,
                              width: `${pct}%`,
                              background: T.green,
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <div style={card}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 12 }}>
                  Más vendidos
                </div>
                {resumen.top.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 15 }}>Sin ventas aún.</div>
                ) : (
                  resumen.top.map(([cod, d], i) => (
                    <div
                      key={cod}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "9px 0",
                        borderBottom: i < resumen.top.length - 1 ? `1px solid ${T.line}` : "none",
                        fontSize: 14,
                      }}
                    >
                      <span>
                        <b>{d.nombre}</b>{" "}
                        <span style={{ color: T.muted }}>· {d.unidades} uds</span>
                      </span>
                      <span style={{ fontWeight: 700 }}>{money(d.ingresos)}</span>
                    </div>
                  ))
                )}
              </div>

              <div style={card}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 12 }}>
                  Avance del bazar
                </div>
                <div style={{ fontSize: 14, marginBottom: 10 }}>
                  Total dado en descuentos / regateo:{" "}
                  <b style={{ color: T.amber }}>{money(resumen.descuentos)}</b>
                </div>
                {(() => {
                  const totalUds = resumen.unidades + resumen.stockRestante;
                  const pct = totalUds > 0 ? Math.round((resumen.unidades / totalUds) * 100) : 0;
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 14, marginBottom: 6 }}>
                        Has vendido el <b>{pct}%</b> de tus artículos.
                      </div>
                      <div style={{ height: 10, background: T.line, borderRadius: 999 }}>
                        <div style={{ height: 10, width: `${pct}%`, background: T.green, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })()}
                {resumen.agotados.length > 0 && (
                  <div style={{ background: T.greenSoft, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                    <b style={{ color: T.green }}>Ya vendidos por completo:</b>{" "}
                    {resumen.agotados.map((p) => p.nombre).join(", ")}
                  </div>
                )}
              </div>
            </div>

            <button style={{ ...btnPrimary, justifySelf: "start" }} onClick={exportarExcel}>
              ⬇ Descargar Excel completo
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: T.ink,
            color: "#fff",
            padding: "12px 22px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            zIndex: 100,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
