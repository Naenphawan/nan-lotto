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
  const numberRef = useRef<HTMLInputElement>(null);

  const baseNum = Number(base || 0);
  const mulNum = Number(mul || 0);
  const amount = calculateAmount(baseNum, mulNum);
  const calcText = mul ? `${baseNum}*${mulNum}` : `${baseNum}`;

  /* ===== LOAD + SYNC ===== */
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

    setNumber('');
    setBase('');
    setMul('');
    numberRef.current?.focus();
  }

  async function deleteGroup(num: string, t: string) {
    const ok = confirm(`ลบเลข ${num} (${t}) ทั้งหมด ใช่หรือไม่`);
    if (!ok) return;

    const targets = records.filter(
      (r) => r.number === num && r.type === t
    );

    for (const r of targets) {
      await deleteDoc(doc(db, 'records', r.id));
    }
  }

  /* ===== SUMMARY ===== */
  const summary = records.reduce<Record<string, any>>((acc, r) => {
    const key = `${r.number}-${r.type}`;
    if (!acc[key])
      acc[key] = {
        number: r.number,
        type: r.type,
        base: 0,
        mul: 0,
        amount: 0,
        calcs: [],
      };

    acc[key].base += r.base;
    acc[key].mul += r.mul;
    acc[key].amount += r.amount;
    acc[key].calcs.push(r.calc);
    return acc;
  }, {});

  const rows = Object.values(summary);
  const over100 = rows.filter((r: any) => r.base >= 100);
  const totalSales = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        <h1 className="text-2xl font-bold text-center">🎯 ระบบขายหวย</h1>

        {/* INPUT */}
        <div className="bg-white p-4 rounded-xl grid grid-cols-5 gap-2">
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
            บันทึก
          </button>
        </div>

        {/* EXPORT */}
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(rows, 'lotto_all.csv')}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Export ทั้งหมด
          </button>
          <button
            onClick={() => exportCSV(over100, 'lotto_over_100.csv')}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Export เลขเกิน 100
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl p-4 overflow-auto">
          <table className="w-full border text-sm">
            <thead className="bg-slate-200">
              <tr>
                <th className="border">เลข</th>
                <th className="border">ประเภท</th>
                <th className="border">เลขหลัก</th>
                <th className="border">โต๊ด</th>
                <th className="border">รวมเงิน</th>
                <th className="border">คำนวณ</th>
                <th className="border">ลบ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={`${r.number}-${r.type}`} className="text-center">
                  <td className="border">{r.number}</td>
                  <td className="border">{r.type}</td>
                  <td className="border">{r.base}</td>
                  <td className="border">{r.mul}</td>
                  <td className="border font-bold">{r.amount}</td>
                  <td className="border text-xs">{r.calcs.join(', ')}</td>
                  <td className="border">
                    <button
                      onClick={() => deleteGroup(r.number, r.type)}
                      className="text-red-600"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xl font-bold text-right">
          💵 รวมทั้งหมด {totalSales} บาท
        </div>

      </div>
    </div>
  );
}
