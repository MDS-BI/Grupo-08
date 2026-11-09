// Datos semilla para las dependencias externas del módulo de Control de Calidad.
// Productos, empleados, recepciones, órdenes de producción y despachos NO se crean
// desde este módulo; se cargan aquí para demo y pruebas.

export const SEED_KEYS = Object.freeze({
  products: 'erp_base:products',
  employees: 'erp_base:employees',
  goods_receipt: 'erp_base:goods_receipts',
  production_order: 'erp_base:production_orders',
  shipment: 'erp_base:shipments'
});

export const seedData = Object.freeze({
  products: Object.freeze([
    { id: 'prod-001', product_id: 'prod-001', name: 'Harina de trigo', standard_cost: 12.5 },
    { id: 'prod-002', product_id: 'prod-002', name: 'Aceite vegetal', standard_cost: 28.0 },
    { id: 'prod-003', product_id: 'prod-003', name: 'Azúcar refinada', standard_cost: 18.75 }
  ]),
  employees: Object.freeze([
    { id: 'emp-001', employee_id: 'emp-001', name: 'Ana Torres', role: 'inspector' },
    { id: 'emp-002', employee_id: 'emp-002', name: 'Luis Ramírez', role: 'inspector' },
    { id: 'emp-003', employee_id: 'emp-003', name: 'María Gómez', role: 'jefe_calidad' },
    { id: 'emp-004', employee_id: 'emp-004', name: 'Pedro Salas', role: 'auditor' }
  ]),
  goods_receipts: Object.freeze([
    { id: 'gr-001', goods_receipt_id: 'gr-001', product_id: 'prod-001', date: '2026-11-02', supplier: 'Molinos del Sur' },
    { id: 'gr-002', goods_receipt_id: 'gr-002', product_id: 'prod-002', date: '2026-11-03', supplier: 'Aceites Andinos' },
    { id: 'gr-003', goods_receipt_id: 'gr-003', product_id: 'prod-003', date: '2026-11-04', supplier: 'Azucarera Central' }
  ]),
  production_orders: Object.freeze([
    { id: 'po-001', production_order_id: 'po-001', product_id: 'prod-001', date: '2026-11-05' },
    { id: 'po-002', production_order_id: 'po-002', product_id: 'prod-002', date: '2026-11-06' }
  ]),
  shipments: Object.freeze([
    { id: 'sh-001', shipment_id: 'sh-001', product_id: 'prod-003', date: '2026-11-07' },
    { id: 'sh-002', shipment_id: 'sh-002', product_id: 'prod-001', date: '2026-11-08' }
  ])
});

export function seedDataSnapshot(){
  return {
    products: seedData.products.map(r => ({ ...r })),
    employees: seedData.employees.map(r => ({ ...r })),
    goods_receipt: seedData.goods_receipts.map(r => ({ ...r })),
    production_order: seedData.production_orders.map(r => ({ ...r })),
    shipment: seedData.shipments.map(r => ({ ...r }))
  };
}
