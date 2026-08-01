import React, { useState } from 'react';
import { X, Copy, Check, Share2, QrCode, ExternalLink, Smartphone, MessageSquare } from 'lucide-react';
import { WifiPackage } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  companySettings: {
    name: string;
    logoText: string;
    themeColor?: string;
    logoUrl?: string;
    tagline?: string;
    contactPhone?: string;
    address?: string;
  };
  packages?: WifiPackage[];
}

export default function ShareModal({ isOpen, onClose, companySettings, packages = [] }: ShareModalProps) {
  const [selectedPkgId, setSelectedPkgId] = useState<string>('all');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  // Build lightweight encoded settings string for instant hydration when opened on any device
  let settingsQueryParam = '';
  try {
    const compactSettings = {
      n: companySettings.name,
      lt: companySettings.logoText,
      tc: companySettings.themeColor || 'blue',
      lu: companySettings.logoUrl || '',
      tg: companySettings.tagline || '',
      ph: companySettings.contactPhone || ''
    };
    settingsQueryParam = `&s=${encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(compactSettings))))}`;
  } catch (err) {
    console.error('Failed to encode settings query param:', err);
  }

  const baseUrl = window.location.origin;
  const targetUrl = selectedPkgId && selectedPkgId !== 'all'
    ? `${baseUrl}/?page=subscribe&pkg=${selectedPkgId}${settingsQueryParam}`
    : `${baseUrl}/?ref=share${settingsQueryParam}`;

  const companyName = companySettings.name || 'Patas.Net';

  // Format WhatsApp share text
  const shareText = `*Halo! Dapatkan Layanan Internet Super Cepat & Tanpa FUP dari ${companyName}!* 🚀\n\n` +
    `✓ Kecepatan Simetris 1:1 & Ping Rendah\n` +
    `✓ Tanpa Batasan Kuota (100% Unlimited)\n` +
    `✓ Layanan CS & Teknisi 24 Jam\n\n` +
    `Klik link pendaftaran resmi di bawah ini untuk pasang baru & cek area lokasi Anda:\n${targetUrl}`;

  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Generate SVG QR Code path matrix mathematically for high precision clean display
  const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}&color=0f172a&bgcolor=ffffff`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Bagikan Link Pendaftaran</h3>
              <p className="text-[11px] text-blue-100 font-medium">Link & Pengaturan otomatis tersinkron ke calon pelanggan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Target Package Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Target Halaman / Paket Khusus
            </label>
            <select
              value={selectedPkgId}
              onChange={(e) => setSelectedPkgId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            >
              <option value="all">🌐 Halaman Utama (Beranda & Pilihan Paket)</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  ⚡ Form Langganan Langsung - {pkg.name} (Rp {pkg.price.toLocaleString('id-ID')}/bln)
                </option>
              ))}
            </select>
          </div>

          {/* Copy URL Input & Button */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Link Resmi Calon Pelanggan
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={targetUrl}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
              </button>
            </div>
          </div>

          {/* Quick Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={waShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-xs">Kirim via WhatsApp</p>
                <p className="text-[10px] text-emerald-600 font-medium">Format pesan promosi otomatis</p>
              </div>
            </a>

            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-xs">Buka di Tab Baru</p>
                <p className="text-[10px] text-slate-500 font-medium">Uji tampilan calon pelanggan</p>
              </div>
            </a>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-slate-800 font-bold text-xs">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>Scan QR Code Ponsel Calon Pelanggan</span>
            </div>
            <div className="flex justify-center p-2 bg-white rounded-xl border border-slate-200/60 inline-block shadow-sm mx-auto">
              <img
                src={qrCodeDataUrl}
                alt="QR Code Pendaftaran"
                className="w-36 h-36 object-contain rounded-lg"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Calon pelanggan dapat memindai QR ini dengan kamera HP untuk langsung membuka form pendaftaran tanpa mengetik URL.
            </p>
          </div>

          {/* Synchronized Notice */}
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-blue-900 text-[11px]">
            <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Tersinkronisasi Otomatis:</strong> Apabila calon pelanggan membuka link ini dari HP atau laptop mana pun, nama perusahaan (<strong>{companyName}</strong>), logo, pilihan paket, dan kontak WhatsApp akan 100% sama dengan pengaturan server Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
