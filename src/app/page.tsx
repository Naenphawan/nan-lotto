'use client';

import { useState, useRef, useEffect } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type RecordItem = {
  id: string;
  number: string;
  type: string;
  base: number;
  mul: number;
  calc: string;
  amount: number;
  date: string;
};

function calculateAmount(base: number, mul: number) {
  if (mul === 3 || mul === 6) return base * mul;
  return base + mul;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
/* ===== EXPORT ===== */
function exportCSV(rows: any[], filename: string) {
  if (rows.length === 0) {
    alert('ไม่มีข้อมูลให้ export');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${r[h] ?? ''}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [number, setNumber] = useState('');
  const [base, setBase] = useState('');
  const [mul, setMul] = useState('');
  const [type, setType] = useState('3 ตัวตรง');
  const [types] = useState(['3 ตัวตรง', '3 ตัวโต๊ด', 'บน', 'ล่าง']);
  const [editId, setEditId] = useState<string | null>(null);

  const numberRef = useRef<HTMLInputElement>(null);

  const baseNum = Number(base || 0);
  const mulNum = Number(mul || 0);
  const amount = calculateAmount(baseNum, mulNum);
  const calcText = mul ? `${baseNum}*${mulNum}` : `${baseNum}`;

  /* 🔥 LOAD + SYNC REALTIME */
  useEffect(() => {
    const q = query(
      collection(db, 'records'),
      where('date', '==', todayKey())
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RecordItem, 'id'>),
      }));
      setRecords(rows);
    });

    numberRef.current?.focus();
    return () => unsub();
  }, []);

  function resetInput() {
    setNumber('');
    setBase('');
    setMul('');
    setEditId(null);
    numberRef.current?.focus();
  }

  async function saveRecord() {
    if (!number || baseNum <= 0) return;

    await addDoc(collection(db, 'records'), {
      number,
      type,
      base: baseNum,
      mul: mulNum,
      calc: calcText,
      amount,
      date: todayKey(),
    });

    resetInput();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRecord();
    }
  }

  function editRecord(r: RecordItem) {
    setEditId(r.id);
    setNumber(r.number);
    setType(r.type);
    setBase(String(r.base));
    setMul(String(r.mul));
    numberRef.current?.focus();
  }

  async function deleteGroup(num: string, t: string) {
    const ok = confirm(`ลบเลข ${num} (${t}) ทั้งหมด ใช่หรือไม่?`);
    if (!ok) return;

    const targets = records.filter(
      (r) => r.number === num && r.type === t
    );

    for (const r of targets) {
      await deleteDoc(doc(db, 'records', r.id));
    }
  }

  /* summary */
  const summary = records.reduce<
    Record<string, { base: number; mul: number; amount: number; calcs: string[] }>
  >((acc, r) => {
    const key = `${r.number}-${r.type}`;
    if (!acc[key]) acc[key] = { base: 0, mul: 0, amount: 0, calcs: [] };
    acc[key].base += r.base;
    acc[key].mul += r.mul;
    acc[key].amount += r.amount;
    acc[key].calcs.push(r.calc);
    return acc;
  }, {});

  const totalSales = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        <h1 className="text-2xl font-bold text-center">🎯 ระบบขายหวย</h1>

        {/* input */}
        <div
          className="bg-white p-4 rounded-xl grid grid-cols-5 gap-2"
          onKeyDown={handleKeyDown}
        >
          <input
            ref={numberRef}
            className="border rounded px-2 py-1 text-center"
            placeholder="เลขหวย"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
          />
          <select
            className="border rounded px-2 py-1 text-center"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="border rounded px-2 py-1 text-right"
            placeholder="เลขหลัก"
            value={base}
            onChange={(e) => setBase(e.target.value.replace(/\D/g, ''))}
          />
          <input
            className="border rounded px-2 py-1 text-right"
            placeholder="ตัวโต๊ด"
            value={mul}
            onChange={(e) => setMul(e.target.value.replace(/\D/g, ''))}
          />
          <button
            onClick={saveRecord}
            className="bg-blue-600 text-white rounded"
          >
            {editId ? 'บันทึกแก้ไข' : 'บันทึก'}
          </button>
        </div>

        {/* table */}
        <div className="bg-white p-4 rounded-xl overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="border-b">
              <tr>
                <th className="w-16 text-center">เลข</th>
                <th className="w-24 text-center">ประเภท</th>
                <th className="text-left">รายการ</th>
                <th className="w-24 text-right">เลขหลัก</th>
                <th className="w-24 text-right">ตัวโต๊ด</th>
                <th className="w-24 text-right">ยอดรวม</th>
                <th className="w-20 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([k, v]) => {
                const [num, t] = k.split('-');
                return (
                  <tr
                    key={k}
                    className={
                      v.base >= 100
                        ? 'bg-red-100'
                        : v.base >= 80
                        ? 'bg-yellow-100'
                        : ''
                    }
                  >
                    <td className="text-center">{num}</td>
                    <td className="text-center">{t}</td>
                    <td className="text-left text-xs">
                      {v.calcs.join(', ')}
                    </td>
                    <td className="text-right">{v.base}</td>
                    <td className="text-right">{v.mul}</td>
                    <td className="text-right font-bold">{v.amount}</td>
                    <td className="text-center space-x-1">
                      <button
                        onClick={() =>
                          editRecord(
                            records.find(
                              (r) => r.number === num && r.type === t
                            )!
                          )
                        }
                        className="text-blue-600 underline text-xs"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => deleteGroup(num, t)}
                        className="text-red-600 underline text-xs"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Export ทั้งหมด
            </button>
            <button className="bg-red-600 text-white px-4 py-2 rounded">
              Export เลขเกิน 100
            </button>
          </div>
          <div className="text-xl font-bold">
            💵 รวมทั้งหมด {totalSales} บาท
          </div>
        </div>

      </div>
    </div>
  );
}
