// ===== Helpers =====
const $ = (id) => document.getElementById(id);

const fields = [
  'lrNo','truckNo','panNo','panName','bankDetail','transportPo','supplyPo',
  'qty','rate','unloadingWeight','freight','gst','advanceBunker','diesel',
  'advance','allowance','shortage','shortageKg','tds','paidBalance','notes'
];

function round2(n){ return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

function readForm(){
  const obj = {};
  fields.forEach(f => obj[f] = ( $(f)?.value || '' ).trim());
  // numeric
  ['qty','rate','unloadingWeight','freight','gst','advanceBunker','diesel','advance','allowance','shortage','shortageKg','tds','paidBalance']
    .forEach(k => obj[k] = Number(obj[k] || 0));

  // calculations
  obj.subtotal = obj.qty * obj.rate + obj.freight;
  obj.gstAmount = obj.subtotal * (obj.gst/100);
  obj.bill = round2(obj.subtotal + obj.gstAmount);
  const deductions = obj.advanceBunker + obj.diesel + obj.advance + obj.allowance + obj.tds + obj.shortage;
  obj.payable = round2(obj.bill - deductions);
  obj.pending = round2(obj.payable - obj.paidBalance);
  return obj;
}

function fillForm(data){
  fields.forEach(f => { if($(f)) $(f).value = data[f] ?? ''; });
  ['qty','rate','unloadingWeight','freight','gst','advanceBunker','diesel','advance','allowance','shortage','shortageKg','tds','paidBalance']
    .forEach(k => { if($(k)) $(k).value = data[k] ?? 0; });
  updateBadge();
}

function clearForm(){
  fields.forEach(f => { if($(f)) $(f).value = ''; });
  ['qty','rate','unloadingWeight','freight','gst','advanceBunker','diesel','advance','allowance','shortage','shortageKg','tds','paidBalance']
    .forEach(k => { if($(k)) $(k).value = (k==='gst' ? 12 : 0); });
  editingIndex = null;
  $('#updateBtn').disabled = true;
  $('#addBtn').disabled = false;
  updateBadge();
}

function updateBadge(){
  const d = readForm();
  $('#calcBadge').textContent = `Subtotal: ₹${d.subtotal.toFixed(2)} | GST: ₹${d.gstAmount.toFixed(2)} | Bill: ₹${d.bill.toFixed(2)} | Payable: ₹${d.payable.toFixed(2)}`;
}

// bind updates
fields.forEach(f => { const el = $(f); if(el) el.addEventListener('input', updateBadge); });

// ===== Storage =====
const LS_KEY = 'transport_billing_rows_v2';
function loadRows(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }catch{ return [] } }
function saveRows(rows){ localStorage.setItem(LS_KEY, JSON.stringify(rows)); }

// ===== Table =====
const tbody = document.querySelector('#dataTable tbody');
function render(){
  const rows = loadRows();
  tbody.innerHTML = '';
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.lrNo||''}</td>
      <td>${r.truckNo||''}</td>
      <td>${Number(r.qty||0).toFixed(2)}</td>
      <td>${Number(r.rate||0).toFixed(2)}</td>
      <td>${Number(r.freight||0).toFixed(2)}</td>
      <td>${Number(r.gst||0).toFixed(2)}</td>
      <td>₹${Number(r.bill||0).toFixed(2)}</td>
      <td>₹${Number(r.payable||0).toFixed(2)}</td>
      <td>₹${Number(r.paidBalance||0).toFixed(2)}</td>
      <td>₹${Number(r.pending||0).toFixed(2)}</td>
      <td class="actions">
        <button class="btn" data-edit="${i}">Edit</button>
        <button class="btn danger" data-del="${i}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

tbody.addEventListener('click', (e)=>{
  const edit = e.target.getAttribute('data-edit');
  const del = e.target.getAttribute('data-del');
  const rows = loadRows();
  if(edit !== null && edit !== undefined){
    const idx = Number(edit);
    editingIndex = idx;
    fillForm(rows[idx]);
    $('#updateBtn').disabled = false;
    $('#addBtn').disabled = true;
  }
  if(del !== null && del !== undefined){
    const idx = Number(del);
    if(confirm('Delete this entry?')){
      rows.splice(idx,1); saveRows(rows); render(); clearForm();
    }
  }
});

// ===== Add / Update =====
let editingIndex = null;
$('#addBtn').addEventListener('click', ()=>{
  const data = readForm();
  const rows = loadRows();
  rows.push({...data, createdAt: new Date().toISOString()});
  saveRows(rows); render(); clearForm();
});

$('#updateBtn').addEventListener('click', ()=>{
  if(editingIndex === null) return;
  const rows = loadRows();
  rows[editingIndex] = { ...rows[editingIndex], ...readForm(), updatedAt: new Date().toISOString() };
  saveRows(rows); render(); clearForm();
});

$('#resetBtn').addEventListener('click', clearForm);

$('#clearAllBtn').addEventListener('click', ()=>{
  if(confirm('Delete ALL entries?')){ saveRows([]); render(); clearForm(); }
});

// ===== Excel Export =====
$('#downloadBtn').addEventListener('click', ()=>{
  const rows = loadRows();
  if(rows.length === 0){ alert('No data to export. Add some entries first.'); return; }
  const excelRows = rows.map(r => ({
    'LR No': r.lrNo, 'Truck No': r.truckNo, 'PAN No': r.panNo,
    'PAN Name': r.panName, 'Bank Detail': r.bankDetail,
    'Transportation PO No': r.transportPo, 'Supply PO No': r.supplyPo,
    'Qty': r.qty, 'Rate': r.rate, 'Unloading Weight': r.unloadingWeight,
    'Freight': r.freight, 'GST %': r.gst, 'GST Amount': r.gstAmount,
    'Subtotal': r.subtotal, 'Bill': r.bill,
    'Advance Bunker': r.advanceBunker, 'Diesel': r.diesel, 'Advance': r.advance,
    'Allowance': r.allowance, 'Shortage (₹)': r.shortage, 'Shortage (Kg)': r.shortageKg, 'TDS (₹)': r.tds,
    'Payable Amount': r.payable, 'Paid Balance': r.paidBalance, 'Pending': r.pending,
    'Notes': r.notes || '', 'Created At': r.createdAt || '', 'Updated At': r.updatedAt || ''
  }));
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const cols = Object.keys(excelRows[0]);
  ws['!cols'] = cols.map(c => ({ wch: Math.max(12, String(c).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bills');
  const fname = `transport_bills_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
});

// init
clearForm();
render();
