import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/InfoPage';

export const metadata: Metadata = { title: 'Size guide' };

/** General measurements, not the shop's own chart. Replace them when the owner sends it. */
const TABLES: { title: string; note: string; headers: string[]; rows: string[][] }[] = [
  {
    title: 'Shirt',
    note: 'Measure around the fullest part of your chest.',
    headers: ['Size', 'Chest (inches)'],
    rows: [
      ['S', '36 to 38'],
      ['M', '38 to 40'],
      ['L', '40 to 42'],
      ['XL', '42 to 44'],
      ['XXL', '44 to 46'],
    ],
  },
  {
    title: 'Panjabi',
    note: 'The size number is the chest in inches.',
    headers: ['Size', 'Chest (inches)'],
    rows: [
      ['40', '40'],
      ['42', '42'],
      ['44', '44'],
    ],
  },
  {
    title: 'Pants',
    note: 'The size number is the waist in inches.',
    headers: ['Size', 'Waist (inches)'],
    rows: [
      ['30', '30'],
      ['32', '32'],
      ['34', '34'],
      ['36', '36'],
    ],
  },
  {
    title: 'Shoes',
    note: 'Measure your foot from heel to longest toe.',
    headers: ['Size (EU)', 'Foot (cm)'],
    rows: [
      ['40', '25.0 to 25.5'],
      ['41', '25.5 to 26.0'],
      ['42', '26.0 to 26.5'],
      ['43', '26.5 to 27.5'],
    ],
  },
];

export default function SizeGuidePage() {
  return (
    <InfoPage title="Size guide">
      <p>
        These are general measurements, and the fit can differ between products. If you are not
        sure, ask us before you order.
      </p>
      {TABLES.map((table) => (
        <section key={table.title}>
          <h2 className="text-lg font-semibold text-slate-900">{table.title}</h2>
          <p className="mt-1 text-sm">{table.note}</p>
          <table className="mt-2 w-full border border-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>
                {table.headers.map((header) => (
                  <th key={header} scope="col" className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </InfoPage>
  );
}
