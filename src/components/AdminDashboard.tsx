import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Settings,
  ShieldCheck,
  Globe,
  Database,
  Trash,
  PhoneCall,
  Search,
  Check,
  RefreshCw,
  Wifi,
  Plus,
  Percent,
  Tag,
  UploadCloud,
  Image,
  FileText,
  Eye,
  EyeOff,
  Save,
  Activity,
  Share2,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { CustomerUser, PaymentRecord, SupportTicket } from '../types';
import { generateCustomerPDFReport, generateAdminMonthlyPDFReport } from '../lib/pdfGenerator';
import { PACKAGES } from './Home';
import Logo from './Logo';
import { GasLogViewer } from './GasLogViewer';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import * as XLSX from 'xlsx';

// Leaflet import for admin map visualization
import L from 'leaflet';

interface AdminDashboardProps {
  customers: CustomerUser[];
  supportTickets: SupportTicket[];
  onRefreshData: () => void;
  onUpdateCustomerStatus: (id: string, status: 'pending' | 'active' | 'suspended') => Promise<void>;
  onVerifyPayment: (userId: string, paymentId: string) => Promise<void>;
  onRejectPayment?: (userId: string, paymentId: string) => Promise<void>;
  whatsappLogs?: any[];
  companySettings?: { name: string; address: string; logoText: string; themeColor: string; logoUrl?: string; promos?: string[]; tagline?: string; billingDate?: number; contactPhone?: string; appScriptWebhookUrl?: string };
  onUpdateCompanySettings?: (newSettings: { name: string; address: string; logoText: string; themeColor: string; logoUrl?: string; tagline?: string; billingDate?: number; contactPhone?: string; appScriptWebhookUrl?: string }) => Promise<boolean>;
  packages?: any[];
  onRefreshPackages?: () => void;
  onOpenShareModal?: () => void;
}

export default function AdminDashboard({
  customers,
  supportTickets,
  onRefreshData,
  onUpdateCustomerStatus,
  onVerifyPayment,
  onRejectPayment,
  whatsappLogs,
  companySettings,
  onUpdateCompanySettings,
  packages = [],
  onRefreshPackages,
  onOpenShareModal
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'payments' | 'tickets' | 'company_settings' | 'coverage' | 'packages' | 'sheets_integration'>('overview');
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserForMap, setSelectedUserForMap] = useState<CustomerUser | null>(null);

  const [sheetSyncState, setSheetSyncState] = useState<'idle' | 'syncing' | 'success'>('success');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru saja');

  // Google Sheets Integration states inside Admin Dashboard
  const [appScriptUrl, setAppScriptUrl] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string>('');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string>('');
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Helper to normalize Google Apps Script Web App URL to ensure it always ends with /exec
  const normalizeGasUrl = (url: string): string => {
    let clean = (url || '').trim();
    if (!clean) return '';
    clean = clean.replace(/\/edit.*$/, '').replace(/\/dev.*$/, '').replace(/\/exec.*$/, '');
    if (!clean.endsWith('/exec')) {
      clean = clean.replace(/\/+$/, '') + '/exec';
    }
    return clean;
  };

  // Sync appScriptUrl from companySettings or localStorage
  useEffect(() => {
    let url = (companySettings as any)?.appScriptWebhookUrl || '';
    if (!url) {
      try {
        const stored = localStorage.getItem('db_company_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          url = parsed.appScriptWebhookUrl || '';
        }
      } catch (e) {}
    }
    if (url) {
      setAppScriptUrl(normalizeGasUrl(url));
    }
  }, [companySettings]);

  // Action to save App Script Web App URL
  const handleSaveAppScriptUrl = async (urlToSave?: string) => {
    const rawUrl = (urlToSave !== undefined ? urlToSave : appScriptUrl).trim();
    if (!rawUrl) {
      setSyncErrorMessage('Harap masukkan URL Web App Google Apps Script.');
      return;
    }
    if (!rawUrl.startsWith('https://script.google.com/')) {
      setSyncErrorMessage('URL tidak valid. Harus diawali dengan https://script.google.com/');
      return;
    }

    if (rawUrl.includes('/home/projects/') || rawUrl.includes('/macros/d/')) {
      setSyncErrorMessage('URL yang Anda masukkan adalah URL Halaman Editor Apps Script, BUKAN Web App URL.\n\nCara mengambil Web App URL yang benar:\n1. Di Apps Script, klik tombol biru "Deploy" (Penerapan) -> "New deployment" (Penerapan Baru).\n2. Di bagian "Who has access", wajib pilih "Anyone" (Siapa saja).\n3. Salin URL yang diawali https://script.google.com/macros/s/... dan berakhiran /exec.');
      return;
    }

    if (!rawUrl.includes('/macros/s/')) {
      setSyncErrorMessage('Format Web App URL tidak valid. URL yang benar harus mengandung "/macros/s/" dan berakhiran "/exec". Silakan salin ulang dari tombol Deploy di Google Apps Script.');
      return;
    }

    const normalizedUrl = normalizeGasUrl(rawUrl);

    setSyncErrorMessage('');
    setSyncSuccessMessage('');

    try {
      if (onUpdateCompanySettings && companySettings) {
        await onUpdateCompanySettings({
          ...companySettings,
          appScriptWebhookUrl: normalizedUrl
        } as any);
      } else {
        const localSettings = { ...companySettings, appScriptWebhookUrl: normalizedUrl };
        localStorage.setItem('db_company_settings', JSON.stringify(localSettings));
        window.dispatchEvent(new Event('storage'));
      }
      setAppScriptUrl(normalizedUrl);
      setSyncSuccessMessage('URL Web App Google Apps Script berhasil disimpan dan diformat (/exec)!');
    } catch (err: any) {
      console.error(err);
      setSyncErrorMessage('Gagal menyimpan URL Web App.');
    }
  };

  // Action to auto-create all sheets and header columns in Google Spreadsheet
  const handleAutoCreateAllSheets = async () => {
    setSyncSuccessMessage('');
    setSyncErrorMessage('');
    const targetUrl = normalizeGasUrl(appScriptUrl);
    if (!targetUrl) {
      setSyncErrorMessage('Harap masukkan URL Web App Google Apps Script Anda terlebih dahulu.');
      return;
    }
    if (!targetUrl.startsWith('https://script.google.com/')) {
      setSyncErrorMessage('Format URL salah. Harus diawali dengan https://script.google.com/');
      return;
    }

    setSyncLoading(true);
    try {
      const response = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          payload: {
            action: 'setup',
            companySettings: companySettings,
            customers: customers,
            tickets: supportTickets,
            packages: packages,
            coverage: coverageList,
            testimonials: []
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success') {
          setSyncSuccessMessage(data.message || 'Seluruh sheet & kolom header BERHASIL dibuat dan diformat otomatis di Google Spreadsheet Anda!');
          await handleSaveAppScriptUrl(targetUrl);
          await onRefreshData();
        } else {
          setSyncErrorMessage('Gagal membuat sheet otomatis: ' + (data.message || 'Respons Apps Script tidak sukses.'));
        }
      } else {
        const errData = await response.json();
        setSyncErrorMessage(errData.message || `Koneksi ditolak (Status: ${response.status}). Pastikan Web App di-deploy dengan akses "Anyone" (Siapa saja).`);
      }
    } catch (err: any) {
      console.error(err);
      setSyncErrorMessage(`Gangguan koneksi: ${err.message || 'Periksa koneksi jaringan Anda.'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Action to pull database from Google Spreadsheet
  const handleLinkAndSyncDatabase = async () => {
    setSyncSuccessMessage('');
    setSyncErrorMessage('');
    const targetUrl = normalizeGasUrl(appScriptUrl);
    if (!targetUrl) {
      setSyncErrorMessage('Harap masukkan URL Web App Google Apps Script Anda.');
      return;
    }

    setSyncLoading(true);
    try {
      const response = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          payload: { action: 'load' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success') {
          if (data.companySettings) {
            localStorage.setItem('db_company_settings', JSON.stringify(data.companySettings));
          }
          if (Array.isArray(data.customers)) {
            localStorage.setItem('db_customers', JSON.stringify(data.customers));
          }
          if (Array.isArray(data.tickets)) {
            localStorage.setItem('db_tickets', JSON.stringify(data.tickets));
          }
          if (Array.isArray(data.packages)) {
            localStorage.setItem('db_packages', JSON.stringify(data.packages));
          }
          if (Array.isArray(data.coverage)) {
            localStorage.setItem('db_coverage_areas', JSON.stringify(data.coverage));
          }
          if (Array.isArray(data.testimonials)) {
            localStorage.setItem('db_testimonials', JSON.stringify(data.testimonials));
          }

          window.dispatchEvent(new Event('storage'));
          setSyncSuccessMessage('Database Berhasil Sinkron! Seluruh data dari Google Spreadsheet berhasil dimuat.');
          await handleSaveAppScriptUrl(targetUrl);
          await onRefreshData();
          if (onRefreshPackages) await onRefreshPackages();
        } else {
          setSyncErrorMessage('Gagal memuat data Google Sheets: ' + (data.message || 'Respons tidak sukses.'));
        }
      } else {
        const errData = await response.json();
        setSyncErrorMessage(errData.message || `Gagal menghubungkan (Status: ${response.status}).`);
      }
    } catch (err: any) {
      console.error(err);
      setSyncErrorMessage(`Gangguan koneksi: ${err.message || 'Periksa jaringan Anda.'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Action to ping / test connection to Google Apps Script
  const handlePingConnection = async () => {
    setSyncSuccessMessage('');
    setSyncErrorMessage('');
    const targetUrl = normalizeGasUrl(appScriptUrl);
    if (!targetUrl) {
      setSyncErrorMessage('Harap masukkan URL Web App Google Apps Script Anda.');
      return;
    }

    setSyncLoading(true);
    try {
      const response = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          payload: { action: 'ping' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success') {
          setSyncSuccessMessage('Koneksi Google Apps Script SANGAT BAIK & Online! Web App Anda siap digunakan.');
          await handleSaveAppScriptUrl(targetUrl);
        } else {
          setSyncErrorMessage('Web App merespons tetapi status tidak sukses: ' + (data.message || 'Error'));
        }
      } else {
        const errData = await response.json();
        setSyncErrorMessage(errData.message || `Web App menolak koneksi (Status: ${response.status}).`);
      }
    } catch (err: any) {
      console.error(err);
      setSyncErrorMessage(`Gagal melakukan tes koneksi: ${err.message || 'Periksa jaringan Anda.'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Action to trigger manual backup to Google Spreadsheet
  const handleTriggerManualBackup = async () => {
    setSyncSuccessMessage('');
    setSyncErrorMessage('');
    const targetUrl = normalizeGasUrl(appScriptUrl);
    if (!targetUrl) {
      setSyncErrorMessage('Harap masukkan URL Web App Google Apps Script Anda.');
      return;
    }

    setSyncLoading(true);
    try {
      const response = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          payload: {
            action: 'backup',
            timestamp: new Date().toISOString(),
            companySettings: companySettings,
            customers: customers,
            tickets: supportTickets,
            packages: packages,
            coverage: coverageList,
            testimonials: []
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success') {
          setSyncSuccessMessage('Berhasil mencadangkan seluruh data ke Google Spreadsheet!');
          await handleSaveAppScriptUrl(targetUrl);
        } else {
          setSyncErrorMessage('Gagal melakukan pencadangan: ' + (data.message || 'Respons tidak sukses'));
        }
      } else {
        const errData = await response.json();
        setSyncErrorMessage(errData.message || `Koneksi ditolak (Status: ${response.status}).`);
      }
    } catch (err: any) {
      console.error(err);
      setSyncErrorMessage(`Gangguan pencadangan: ${err.message || 'Gangguan koneksi'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Copy Google Apps Script code snippet
  const handleCopyAppsScriptCode = () => {
    const scriptCode = `/**
 * Google Apps Script Web App Template (Patasnet / Taranet WiFi)
 * Copy and paste this code into Extensions -> Apps Script inside your Google Spreadsheet!
 * This script will AUTOMATICALLY create all necessary sheets and columns on its first execution!
 */

function doGet(e) {
  var data = {};
  if (e && e.parameter) {
    data = e.parameter;
    if (e.parameter.payload) {
      try {
        if (typeof e.parameter.payload === 'string') {
          data = JSON.parse(e.parameter.payload);
        } else {
          data = e.parameter.payload;
        }
      } catch(err) {}
    }
  }
  if (!data || !data.action) { data = { action: "ping" }; }
  return handleAction(data);
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
  } catch(err) {
    data = {};
  }
  if ((!data || !data.action) && e && e.parameter && e.parameter.action) {
    data.action = e.parameter.action;
  }
  if ((!data || !data.action) && e && e.parameter && e.parameter.payload) {
    try {
      if (typeof e.parameter.payload === 'string') {
        data = JSON.parse(e.parameter.payload);
      } else {
        data = e.parameter.payload;
      }
    } catch(err) {}
  }
  if (!data || !data.action) { data = { action: "ping" }; }
  return handleAction(data);
}

function handleAction(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ping / connection test handler
    if (!data || !data.action || data.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Koneksi Google Apps Script Aktif & Berhasil!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Direct upload handler to Google Drive for KTP photos, payment proofs, logos, and images
    if (data.action === "upload_file") {
      try {
        var folderName = data.folderName || "Patasnet_Drive_Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var base64Raw = data.base64Data || "";
        var contentType = "image/jpeg";
        if (base64Raw.indexOf("data:") === 0) {
          contentType = base64Raw.split(",")[0].split(":")[1].split(";")[0];
          base64Raw = base64Raw.split(",")[1];
        }
        var decoded = Utilities.base64Decode(base64Raw);
        var blob = Utilities.newBlob(decoded, contentType, data.fileName || ("file_" + Date.now() + ".jpg"));
        
        var file = targetFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        var fileId = file.getId();
        var directUrl = "https://lh3.googleusercontent.com/d/" + fileId;
        
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "File berhasil diunggah ke Google Drive!",
          fileUrl: directUrl,
          fileId: fileId
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (uploadErr) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Gagal mengunggah file ke Google Drive: " + uploadErr.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Helper function to insert a sheet if missing and setup styling and headers
    function getOrCreateSheet(name, headers) {
      var sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(headers);
        
        // Format headers: bold, background slate, text white
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#0f172a"); // slate-900
        headerRange.setFontColor("#f8fafc");  // slate-50
        sheet.setFrozenRows(1);
      }
      return sheet;
    }

    // Ensure all 7 master sheets exist
    var sheetSettings = getOrCreateSheet("Pengaturan_Sistem", [
      "Nama Perusahaan", "Alamat Kantor", "Teks Logo", "Warna Tema", "Tagline", "Tanggal Jatuh Tempo", "No Kontak Telepon", "Terakhir Diperbarui"
    ]);
    var sheetCustomers = getOrCreateSheet("Pelanggan", [
      "ID Pelanggan", "Nama Lengkap", "Email", "Nomor Handphone", "Alamat Rumah", "Koordinat GPS", "ID Paket", "Status Akun", "Tanggal Daftar", "Tautan Foto KTP"
    ]);
    var sheetPayments = getOrCreateSheet("Tagihan_Pembayaran", [
      "ID Pembayaran", "ID Pelanggan", "Nama Pelanggan", "Tanggal Transaksi", "Jumlah Rp", "Status", "Periode", "Metode", "ID Transaksi", "Tautan Bukti Bayar"
    ]);
    var sheetTickets = getOrCreateSheet("Tiket_Dukungan", [
      "ID Tiket", "ID Pelanggan", "Nama Pengirim", "Email", "No Handphone", "Pesan Pengaduan", "Tanggal Pengaduan", "Status"
    ]);
    var sheetPackages = getOrCreateSheet("Paket_Internet", [
      "ID Paket", "Nama Layanan", "Kecepatan", "Harga Bulanan Rp", "Kategori Tipe", "Daftar Fitur", "Rekomendasi Populer"
    ]);
    var sheetCoverage = getOrCreateSheet("Cakupan_Wilayah", [
      "Nama Kota / Kabupaten", "Tipe Wilayah", "Total Kecamatan", "Total Kelurahan Tercover"
    ]);
    var sheetTestimonials = getOrCreateSheet("Testimoni_Pelanggan", [
      "ID Testimoni", "Nama Pengulas", "Role / Paket", "Lokasi", "Rating Bintang", "Isi Ulasan", "Tag Kategori", "Tanggal"
    ]);

    if (data.action === "setup") {
      var sheetsList = ss.getSheets();
      sheetsList.forEach(function(sh) {
        if (sh.getLastColumn() > 0) {
          sh.autoResizeColumns(1, sh.getLastColumn());
        }
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Seluruh sheet (Pengaturan_Sistem, Pelanggan, Tagihan_Pembayaran, Tiket_Dukungan, Paket_Internet, Cakupan_Wilayah, Testimoni_Pelanggan) dan kolom header BERHASIL dibuat dan diformat otomatis!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Support retrieving the complete database to synchronize new devices
    if (data.action === "load") {
      var result = {
        status: "success"
      };
      
      // Read Pengaturan_Sistem
      if (sheetSettings && sheetSettings.getLastRow() >= 2) {
        var row = sheetSettings.getRange(2, 1, 1, 7).getValues()[0];
        result.companySettings = {
          name: row[0],
          address: row[1],
          logoText: row[2],
          themeColor: row[3],
          tagline: row[4],
          billingDate: row[5],
          contactPhone: row[6]
        };
      }
      
      // Read Pelanggan & Tagihan_Pembayaran
      var customers = [];
      if (sheetCustomers && sheetCustomers.getLastRow() >= 2) {
        var rows = sheetCustomers.getRange(2, 1, sheetCustomers.getLastRow() - 1, 10).getValues();
        rows.forEach(function(r) {
          if (r[0]) {
            var coords = [-6.2088, 106.8456];
            if (r[5] && typeof r[5] === "string" && r[5].indexOf(",") > -1) {
              var parts = r[5].split(",");
              coords = [parseFloat(parts[0].trim()), parseFloat(parts[1].trim())];
            }
            customers.push({
              id: String(r[0]),
              name: String(r[1]),
              email: String(r[2]),
              phone: String(r[3]),
              address: String(r[4]),
              coordinates: coords,
              packageId: String(r[6] || "home-50"),
              status: String(r[7] || "pending"),
              createdAt: String(r[8]),
              ktpUrl: String(r[9] || ""),
              payments: []
            });
          }
        });
      }
      
      if (sheetPayments && sheetPayments.getLastRow() >= 2) {
        var pRows = sheetPayments.getRange(2, 1, sheetPayments.getLastRow() - 1, 10).getValues();
        pRows.forEach(function(r) {
          if (r[0] && r[1]) {
            var cust = customers.find(function(c) { return c.id === String(r[1]); });
            if (cust) {
              cust.payments.push({
                id: String(r[0]),
                date: String(r[3]),
                amount: Number(r[4] || 0),
                status: String(r[5] || "paid"),
                billingPeriod: String(r[6] || ""),
                method: String(r[7] || "Transfer Bank"),
                transactionId: String(r[8] || ""),
                proofUrl: String(r[9] || "")
              });
            }
          }
        });
      }
      
      result.customers = customers;
      
      // Read Tiket_Dukungan
      var tickets = [];
      if (sheetTickets && sheetTickets.getLastRow() >= 2) {
        var tRows = sheetTickets.getRange(2, 1, sheetTickets.getLastRow() - 1, 8).getValues();
        tRows.forEach(function(r) {
          if (r[0]) {
            tickets.push({
              id: String(r[0]),
              userId: String(r[1] || ""),
              name: String(r[2] || ""),
              email: String(r[3] || ""),
              phone: String(r[4] || ""),
              message: String(r[5] || ""),
              date: String(r[6] || ""),
              status: String(r[7] || "open")
            });
          }
        });
      }
      result.tickets = tickets;
      
      // Read Paket_Internet
      var packages = [];
      if (sheetPackages && sheetPackages.getLastRow() >= 2) {
        var pkgRows = sheetPackages.getRange(2, 1, sheetPackages.getLastRow() - 1, 7).getValues();
        pkgRows.forEach(function(r) {
          if (r[0]) {
            packages.push({
              id: String(r[0]),
              name: String(r[1]),
              speed: String(r[2]),
              price: Number(r[3] || 0),
              type: String(r[4] || "home"),
              features: r[5] ? String(r[5]).split(", ") : [],
              popular: Boolean(r[6])
            });
          }
        });
      }
      result.packages = packages;
      
      // Read Cakupan_Wilayah
      var coverage = [];
      if (sheetCoverage && sheetCoverage.getLastRow() >= 2) {
        var covRows = sheetCoverage.getRange(2, 1, sheetCoverage.getLastRow() - 1, 4).getValues();
        covRows.forEach(function(r) {
          if (r[0]) {
            coverage.push({
              cityName: String(r[0]),
              regionType: String(r[1] || "Kota"),
              totalKecamatans: Number(r[2] || 0),
              totalKelurahans: Number(r[3] || 0)
            });
          }
        });
      }
      result.coverage = coverage;
      
      // Read Testimoni_Pelanggan
      var testimonials = [];
      if (sheetTestimonials && sheetTestimonials.getLastRow() >= 2) {
        var testiRows = sheetTestimonials.getRange(2, 1, sheetTestimonials.getLastRow() - 1, 8).getValues();
        testiRows.forEach(function(r) {
          if (r[0]) {
            testimonials.push({
              id: String(r[0]),
              name: String(r[1]),
              role: String(r[2]),
              location: String(r[3]),
              rating: Number(r[4] || 5),
              comment: String(r[5]),
              category: String(r[6]),
              date: String(r[7])
            });
          }
        });
      }
      result.testimonials = testimonials;

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. SYSTEM CONFIGURATION SHEET
    if (data.companySettings) {
      if (sheetSettings.getLastRow() > 1) {
        sheetSettings.deleteRows(2, sheetSettings.getLastRow() - 1);
      }
      sheetSettings.appendRow([
        data.companySettings.name || "Patasnet Wifi",
        data.companySettings.address || "",
        data.companySettings.logoText || "PATAS wifi",
        data.companySettings.themeColor || "#2563eb",
        data.companySettings.tagline || "ULTRA BROADBAND",
        data.companySettings.billingDate || 20,
        data.companySettings.contactPhone || "+62 899-3299-977",
        new Date().toISOString()
      ]);
    }
    
    // 2. CUSTOMER LIST & BILLING PAYMENTS
    if (data.customers) {
      if (sheetCustomers.getLastRow() > 1) {
        sheetCustomers.deleteRows(2, sheetCustomers.getLastRow() - 1);
      }
      if (sheetPayments.getLastRow() > 1) {
        sheetPayments.deleteRows(2, sheetPayments.getLastRow() - 1);
      }
      
      data.customers.forEach(function(c) {
        var coordStr = c.coordinates ? (c.coordinates[0] + ", " + c.coordinates[1]) : "-6.2088, 106.8456";
        sheetCustomers.appendRow([
          c.id,
          c.name,
          c.email,
          c.phone,
          c.address,
          coordStr,
          c.packageId,
          c.status,
          c.createdAt || new Date().toISOString(),
          c.ktpUrl || ""
        ]);
        
        if (c.payments && c.payments.length > 0) {
          c.payments.forEach(function(p) {
            sheetPayments.appendRow([
              p.id,
              c.id,
              c.name,
              p.date,
              p.amount,
              p.status,
              p.billingPeriod || "",
              p.method || "Transfer Bank",
              p.transactionId || "",
              p.proofUrl || ""
            ]);
          });
        }
      });
    }
    
    // 3. SUPPORT TICKETS
    if (data.tickets) {
      if (sheetTickets.getLastRow() > 1) {
        sheetTickets.deleteRows(2, sheetTickets.getLastRow() - 1);
      }
      data.tickets.forEach(function(t) {
        sheetTickets.appendRow([
          t.id,
          t.userId || "",
          t.name || "",
          t.email || "",
          t.phone || "",
          t.message || "",
          t.date || new Date().toISOString(),
          t.status || "open"
        ]);
      });
    }
    
    // 4. BROADBAND PACKAGES
    if (data.packages) {
      if (sheetPackages.getLastRow() > 1) {
        sheetPackages.deleteRows(2, sheetPackages.getLastRow() - 1);
      }
      data.packages.forEach(function(pkg) {
        sheetPackages.appendRow([
          pkg.id,
          pkg.name,
          pkg.speed,
          pkg.price,
          pkg.type,
          pkg.features ? pkg.features.join(", ") : "",
          pkg.popular ? "Ya" : "Tidak"
        ]);
      });
    }
    
    // 5. COVERAGE AREAS
    if (data.coverage) {
      if (sheetCoverage.getLastRow() > 1) {
        sheetCoverage.deleteRows(2, sheetCoverage.getLastRow() - 1);
      }
      data.coverage.forEach(function(cov) {
        sheetCoverage.appendRow([
          cov.cityName,
          cov.regionType || "Kota",
          cov.totalKecamatans || 0,
          cov.totalKelurahans || 0
        ]);
      });
    }
    
    // 6. CUSTOMER TESTIMONIALS
    if (data.testimonials) {
      if (sheetTestimonials.getLastRow() > 1) {
        sheetTestimonials.deleteRows(2, sheetTestimonials.getLastRow() - 1);
      }
      data.testimonials.forEach(function(testi) {
        sheetTestimonials.appendRow([
          testi.id,
          testi.name,
          testi.role,
          testi.location,
          testi.rating,
          testi.comment,
          testi.category,
          testi.date
        ]);
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data berhasil dicadangkan dan diperbarui ke Google Spreadsheet!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const performDatabaseSync = async (forceClearCache = false) => {
    setSheetSyncState('syncing');
    try {
      if (forceClearCache) {
        localStorage.removeItem('db_customers');
        localStorage.removeItem('db_tickets');
        localStorage.removeItem('db_packages');
        localStorage.removeItem('db_coverage_areas');
        localStorage.removeItem('db_testimonials');
        localStorage.removeItem('db_company_settings');
        localStorage.removeItem('db_whatsapp_logs');
      }

      // Check for connected Google Sheets Web App URL
      let webhookUrl = (companySettings as any)?.appScriptWebhookUrl;
      if (!webhookUrl) {
        try {
          const stored = localStorage.getItem('db_company_settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            webhookUrl = parsed.appScriptWebhookUrl;
          }
        } catch (e) {
          // ignore
        }
      }

      if (webhookUrl && webhookUrl.trim().startsWith('https://script.google.com/')) {
        try {
          const response = await fetch(webhookUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load' })
          });
          if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'success') {
              if (Array.isArray(data.customers)) {
                localStorage.setItem('db_customers', JSON.stringify(data.customers));
              }
              if (Array.isArray(data.tickets)) {
                localStorage.setItem('db_tickets', JSON.stringify(data.tickets));
              }
              if (Array.isArray(data.packages)) {
                localStorage.setItem('db_packages', JSON.stringify(data.packages));
              }
              if (Array.isArray(data.coverage)) {
                localStorage.setItem('db_coverage_areas', JSON.stringify(data.coverage));
              }
              if (Array.isArray(data.testimonials)) {
                localStorage.setItem('db_testimonials', JSON.stringify(data.testimonials));
              }
              if (data.companySettings) {
                localStorage.setItem('db_company_settings', JSON.stringify(data.companySettings));
              }
              window.dispatchEvent(new Event('storage'));
            }
          }
        } catch (err) {
          console.warn('Sync with Google Sheets background attempt warning:', err);
        }
      }

      // Always call parent refresh functions to update React state
      await onRefreshData();
      if (onRefreshPackages) {
        await onRefreshPackages();
      }

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setLastSyncTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      setSheetSyncState('success');

      if (forceClearCache) {
        setSuccessToastMessage('Database berhasil di-refresh! Cache lokal dibersihkan & data terbaru dimuat dari Google Sheets/Server.');
        setTimeout(() => setSuccessToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to sync database:', err);
      setSheetSyncState('idle');
    }
  };

  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setLastSyncTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

    // Periodic background sync every 30 seconds
    const interval = setInterval(() => {
      performDatabaseSync(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [onRefreshData, onRefreshPackages, companySettings]);

  // Count payments waiting for verification
  const pendingPaymentsCount = customers.reduce(
    (count, c) => count + (c.payments?.filter((p) => p.status === 'pending_verification').length || 0),
    0
  );

  // Company Settings form states
  const [companyNameInput, setCompanyNameInput] = useState(companySettings?.name || 'Patas.Net');
  const [companyAddressInput, setCompanyAddressInput] = useState(companySettings?.address || '');
  const [companyLogoTextInput, setCompanyLogoTextInput] = useState(companySettings?.logoText || 'PATAS wifi');
  const [companyLogoUrlInput, setCompanyLogoUrlInput] = useState(companySettings?.logoUrl || '');
  const [companyTaglineInput, setCompanyTaglineInput] = useState(companySettings?.tagline || 'ULTRA BROADBAND');
  const [companyBillingDateInput, setCompanyBillingDateInput] = useState<number>(companySettings?.billingDate || 20);
  const [companyPhoneInput, setCompanyPhoneInput] = useState(companySettings?.contactPhone || '+62 899-3299-977');
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Sync inputs with props if they load later
  useEffect(() => {
    if (companySettings) {
      setCompanyNameInput(companySettings.name);
      setCompanyAddressInput(companySettings.address);
      setCompanyLogoTextInput(companySettings.logoText);
      setCompanyLogoUrlInput(companySettings.logoUrl || '');
      setCompanyTaglineInput(companySettings.tagline || 'ULTRA BROADBAND');
      setCompanyBillingDateInput(companySettings.billingDate || 20);
      setCompanyPhoneInput(companySettings.contactPhone || '+62 899-3299-977');
    }
  }, [companySettings]);

  const [coverageList, setCoverageList] = useState<any[]>([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    variant?: 'danger' | 'primary' | 'success';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Ya, Hapus',
    variant: 'danger',
  });

  // Coverage forms state
  const [newCityName, setNewCityName] = useState('');
  const [newCityType, setNewCityType] = useState('Kota');
  const [newKecName, setNewKecName] = useState<{ [city: string]: string }>({});
  const [newKelName, setNewKelName] = useState<{ [kecKey: string]: string }>({});

  // Wifi Package form states
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgSpeed, setNewPkgSpeed] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [newPkgType, setNewPkgType] = useState('home');
  const [newPkgFeatures, setNewPkgFeatures] = useState('');
  const [newPkgPopular, setNewPkgPopular] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);

  // Promo upload states
  const [promoImageBase64, setPromoImageBase64] = useState('');
  const [uploadingPromo, setUploadingPromo] = useState(false);

  const handleUpdateCustomerPackage = async (id: string, packageId: string) => {
    try {
      const response = await fetch('/api/customers/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, packageId }),
      });
      if (response.ok) {
        onRefreshData();
      } else {
        const err = await response.json();
        alert('Gagal memperbarui paket: ' + err.message);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const fetchCoverageList = async () => {
    setLoadingCoverage(true);
    try {
      const response = await fetch('/api/coverage');
      if (response.ok) {
        const data = await response.json();
        setCoverageList(data || []);
        onRefreshData(); // Propagate coverage data change to App.tsx
      }
    } catch (err) {
      console.error('Failed to fetch coverage:', err);
    } finally {
      setLoadingCoverage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coverage') {
      fetchCoverageList();
    }
  }, [activeTab]);

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgName || !newPkgSpeed || !newPkgPrice) {
      alert('Semua kolom bertanda * wajib diisi!');
      return;
    }
    setAddingPackage(true);
    try {
      const featuresArr = newPkgFeatures
        .split(/[,\n]/)
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const response = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPkgName,
          speed: newPkgSpeed,
          price: Number(newPkgPrice),
          type: newPkgType,
          features: featuresArr,
          popular: newPkgPopular
        })
      });

      if (response.ok) {
        setNewPkgName('');
        setNewPkgSpeed('');
        setNewPkgPrice('');
        setNewPkgFeatures('');
        setNewPkgPopular(false);
        if (onRefreshPackages) {
          onRefreshPackages();
        }
        alert('Paket WiFi baru berhasil ditambahkan!');
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menambahkan paket WiFi.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setAddingPackage(false);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Paket WiFi',
      message: 'Apakah Anda yakin ingin menghapus paket WiFi ini?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/packages/${pkgId}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            if (onRefreshPackages) {
              onRefreshPackages();
            }
            alert('Paket WiFi berhasil dihapus.');
          } else {
            alert('Gagal menghapus paket WiFi.');
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi kesalahan koneksi.');
        }
      }
    });
  };

  const handleDeleteCustomer = async (customerId: string) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Pelanggan',
      message: 'Apakah Anda yakin ingin menghapus pelanggan ini dari sistem? Tindakan ini permanen dan tidak dapat dibatalkan.',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            onRefreshData();
            alert('Pelanggan berhasil dihapus dari sistem.');
          } else {
            alert('Gagal menghapus pelanggan.');
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi kesalahan koneksi.');
        }
      }
    });
  };

  const handleUploadPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoImageBase64) {
      alert('Pilih berkas gambar promo terlebih dahulu!');
      return;
    }
    setUploadingPromo(true);
    try {
      const response = await fetch('/api/settings/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoImageBase64 })
      });
      if (response.ok) {
        setPromoImageBase64('');
        onRefreshData();
        alert('Gambar promo berhasil diunggah!');
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal mengunggah promo.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setUploadingPromo(false);
    }
  };

  const handleDeletePromo = async (index: number) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Promo',
      message: 'Apakah Anda yakin ingin menghapus promo ini?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/settings/promos/${index}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            onRefreshData();
            alert('Promo berhasil dihapus.');
          } else {
            alert('Gagal menghapus promo.');
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi kesalahan koneksi.');
        }
      }
    });
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;

    try {
      const response = await fetch('/api/coverage/city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: newCityName.trim(), regionType: newCityType })
      });
      if (response.ok) {
        setNewCityName('');
        await fetchCoverageList();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menambahkan kota.');
      }
    } catch (err) {
      console.error(err);
      alert('Kesalahan jaringan.');
    }
  };

  const handleDeleteCity = async (cityName: string) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Kota/Kabupaten',
      message: `Apakah Anda yakin ingin menghapus Kota/Kabupaten ${cityName} beserta seluruh Kecamatan & Kelurahan di dalamnya?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/coverage/city/${encodeURIComponent(cityName)}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            await fetchCoverageList();
          } else {
            alert('Gagal menghapus kota.');
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleAddKecamatan = async (cityName: string) => {
    const name = newKecName[cityName];
    if (!name || !name.trim()) return;

    try {
      const response = await fetch('/api/coverage/kecamatan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName, name: name.trim() })
      });
      if (response.ok) {
        setNewKecName(prev => ({ ...prev, [cityName]: '' }));
        await fetchCoverageList();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menambahkan kecamatan.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKecamatan = async (cityName: string, name: string) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Kecamatan',
      message: `Hapus kecamatan ${name}?`,
      onConfirm: async () => {
        try {
          const response = await fetch('/api/coverage/kecamatan/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityName, name })
          });
          if (response.ok) {
            await fetchCoverageList();
          } else {
            alert('Gagal menghapus kecamatan.');
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleAddKelurahan = async (cityName: string, kecamatanName: string) => {
    const key = `${cityName}-${kecamatanName}`;
    const name = newKelName[key];
    if (!name || !name.trim()) return;

    try {
      const response = await fetch('/api/coverage/kelurahan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName, kecamatanName, name: name.trim() })
      });
      if (response.ok) {
        setNewKelName(prev => ({ ...prev, [key]: '' }));
        await fetchCoverageList();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menambahkan kelurahan.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKelurahan = async (cityName: string, kecamatanName: string, name: string) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Kelurahan',
      message: `Hapus kelurahan ${name}?`,
      onConfirm: async () => {
        try {
          const response = await fetch('/api/coverage/kelurahan/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityName, kecamatanName, name })
          });
          if (response.ok) {
            await fetchCoverageList();
          } else {
            alert('Gagal menghapus kelurahan.');
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCompanySettings) return;

    setSavingSettings(true);
    const success = await onUpdateCompanySettings({
      name: companyNameInput,
      address: companyAddressInput,
      logoText: companyLogoTextInput,
      themeColor: '#2563eb',
      logoUrl: companyLogoUrlInput,
      tagline: companyTaglineInput,
      billingDate: companyBillingDateInput,
      contactPhone: companyPhoneInput
    });
    setSavingSettings(false);
    if (success) {
      alert('Pengaturan identitas perusahaan berhasil diperbarui!');
    } else {
      alert('Gagal memperbarui pengaturan.');
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    setConfirmModal({
      show: true,
      title: 'Konfirmasi Selesaikan Laporan',
      message: 'Apakah Anda yakin ingin menyelesaikan laporan gangguan ini? Koneksi internet pelanggan akan dipastikan kembali normal, dan pemberitahuan WhatsApp penyelesaian tiket akan terkirim otomatis.',
      confirmText: 'Ya, Selesaikan',
      variant: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/support/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId })
          });

          if (response.ok) {
            onRefreshData();
            setSuccessToastMessage('Tiket keluhan / laporan gangguan berhasil diselesaikan!');
            setTimeout(() => setSuccessToastMessage(null), 4000);
          } else {
            alert('Gagal menyelesaikan laporan gangguan.');
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi kesalahan jaringan.');
        }
      }
    });
  };

  const handleSendWhatsAppReminder = async (userId: string, paymentId: string, type: 'before_due' | 'overdue') => {
    setSendingReminderId(`${paymentId}-${type}`);
    try {
      const response = await fetch('/api/whatsapp/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentId, type })
      });
      if (response.ok) {
        alert('Notifikasi Pengingat WhatsApp berhasil dikirim ke pelanggan!');
        onRefreshData(); // refresh logs
      } else {
        alert('Gagal mengirim pengingat WhatsApp.');
      }
    } catch (err) {
      console.error(err);
      alert('Kesalahan jaringan.');
    } finally {
      setSendingReminderId(null);
    }
  };

  // Stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const pendingCustomers = customers.filter((c) => c.status === 'pending').length;
  const suspendedCustomers = customers.filter((c) => c.status === 'suspended').length;

  // Revenue calculation
  let totalRevenue = 0;
  let dailyRevenueHistory: { date: string; revenue: number }[] = [];
  let packageCount: { [key: string]: number } = {};

  const revenueByDate: { [dateStr: string]: number } = {};

  // Calculate actual transaction revenue and gather counts
  customers.forEach((c) => {
    // Count packages
    const pkg = PACKAGES.find((p) => p.id === c.packageId);
    if (pkg) {
      packageCount[pkg.name] = (packageCount[pkg.name] || 0) + 1;
    }

    c.payments.forEach((p) => {
      if (p.status === 'paid') {
        totalRevenue += p.amount;

        // Parse and format date to Indonesian format (e.g. "15 Jul")
        const paymentDateObj = new Date(p.date);
        if (!isNaN(paymentDateObj.getTime())) {
          const dateStr = paymentDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + p.amount;
        }
      }
    });
  });

  // Compile the last 20 days of revenue history deterministically
  const today = new Date();
  for (let i = 19; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    dailyRevenueHistory.push({
      date: dateStr,
      revenue: revenueByDate[dateStr] || 0
    });
  }

  // Recharts colors
  const COLORS = ['#2563eb', '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const pieData = Object.keys(packageCount).map((key) => ({
    name: key,
    value: packageCount[key]
  }));

  // WhatsApp automatic log simulations state
  const [waLogs, setWaLogs] = useState<{ id: string; phone: string; message: string; time: string }[]>([]);

  // Keep waLogs synchronized with props or default simulated ones
  useEffect(() => {
    if (whatsappLogs && whatsappLogs.length > 0) {
      setWaLogs(whatsappLogs);
    }
  }, [whatsappLogs]);

  // Function to simulate sending WhatsApp
  const logWhatsAppNotification = (phone: string, customerName: string, period: string, amount: number) => {
    const log = {
      id: Math.random().toString(36).substr(2, 9),
      phone,
      message: `[WhatsApp Otomatis] Halo ${customerName}, Pembayaran tagihan Patas.Net Wifi Anda untuk periode ${period} sebesar Rp ${amount.toLocaleString('id-ID')} telah BERHASIL diverifikasi dan Lunas. Internet Anda tetap aktif & stabil tanpa FUP. Terima kasih!`,
      time: new Date().toLocaleTimeString('id-ID')
    };
    setWaLogs((prev) => [log, ...prev]);
  };

  // Export to Excel using xlsx sheetjs library
  const handleExportToExcel = () => {
    const rows: any[] = [];

    customers.forEach((c) => {
      const pkg = PACKAGES.find((p) => p.id === c.packageId);
      c.payments.forEach((p) => {
        rows.push({
          'ID Pelanggan': c.id,
          'Nama Pelanggan': c.name,
          'Email': c.email,
          'No Handphone': c.phone,
          'Alamat': c.address,
          'Koordinat GPS': `${c.coordinates[0]}, ${c.coordinates[1]}`,
          'Paket Berlangganan': pkg?.name || 'Unknown',
          'Kecepatan': pkg?.speed || 'Unknown',
          'Biaya Bulanan': pkg?.price || 0,
          'Periode Tagihan': p.billingPeriod,
          'Jumlah Bayar': p.amount,
          'Status Pembayaran': p.status.toUpperCase(),
          'Metode Bayar': p.method || 'N/A',
          'Tanggal Transaksi': p.date
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi Patasnet');

    // Auto fit column widths
    const max_width = rows.reduce((w, r) => Math.max(w, Object.values(r).join('').length / 8), 10);
    worksheet['!cols'] = [{ wch: max_width }];

    // Generate Excel File
    XLSX.writeFile(workbook, `Laporan_Transaksi_Patasnet_Wifi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportToPDF = () => {
    generateAdminMonthlyPDFReport(customers, supportTickets, companySettings?.name || 'Patas.Net');
  };



  // Interactive leafet map display for customer pins
  useEffect(() => {
    if (activeTab !== 'customers' || !customers || customers.length === 0) return;

    const mapElement = document.getElementById('admin-customers-map');
    if (!mapElement) return;

    // Remove old map instance if existing
    const existingMap = (mapElement as any)._leaflet_map;
    if (existingMap) {
      existingMap.remove();
    }

    const defaultCenter: [number, number] = [-6.2088, 106.8456];
    const map = L.map(mapElement).setView(defaultCenter, 11);
    (mapElement as any)._leaflet_map = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Override marker icons safely
    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Plot each customer's coordinates
    customers.forEach((c) => {
      if (c.coordinates && c.coordinates.length === 2) {
        const marker = L.marker(c.coordinates, { icon: DefaultIcon }).addTo(map);
        const pkg = PACKAGES.find((p) => p.id === c.packageId);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
            <strong style="font-size: 13px; color: #1e3a8a;">${c.name}</strong><br/>
            <strong>No HP:</strong> ${c.phone}<br/>
            <strong>Paket:</strong> ${pkg?.name || 'N/A'}<br/>
            <strong>Status:</strong> <span style="font-weight:bold; color: ${c.status === 'active' ? '#10b981' : '#f59e0b'}">${c.status.toUpperCase()}</span><br/>
            <strong>Alamat:</strong> ${c.address}
          </div>
        `);
      }
    });

    // Re-invalidate size to trigger proper rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (map) {
        map.remove();
        delete (mapElement as any)._leaflet_map;
      }
    };
  }, [activeTab, customers]);

  // Handle focus on map coordinate
  const handleFocusOnMap = (customer: CustomerUser) => {
    setSelectedUserForMap(customer);
    const mapElement = document.getElementById('admin-customers-map');
    if (mapElement) {
      const map = (mapElement as any)._leaflet_map;
      if (map && customer.coordinates) {
        map.setView(customer.coordinates, 15);
        // Find existing markers and trigger popup could be added, but setting center is sufficient
      }
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-2 sm:px-6 flex flex-row gap-4 sm:gap-8 text-xs relative">
      {/* Floating Success Toast */}
      {successToastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-500 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="font-extrabold text-xs">{successToastMessage}</span>
        </div>
      )}

      {/* Floating Toggle Menu Button (only visible when sidebar is closed) */}
      {!showSidebar && (
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          className="fixed bottom-6 left-6 z-40 p-3.5 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-600/50 hover:bg-blue-700 transition-all active:scale-95 border border-blue-500 flex items-center justify-center animate-in fade-in zoom-in duration-200"
          title="Tampilkan Menu"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      )}

      {/* LEFT SIDEBAR NAVIGATION PANEL */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <aside
        className={`${
          showSidebar ? 'translate-x-0 w-64' : '-translate-x-full md:w-0 md:opacity-0 md:overflow-hidden'
        } fixed md:sticky inset-y-0 left-0 z-50 md:z-30 shrink-0 transition-all duration-300 ease-in-out bg-white md:bg-transparent h-full md:h-[calc(100vh-160px)] md:top-28 md:self-start overflow-y-auto`}
      >
        <div className="bg-white rounded-none md:rounded-3xl border-r md:border border-slate-200/80 shadow-2xl md:shadow-md p-5 md:p-6 flex flex-col gap-4 md:gap-6 h-full w-64">
          <div className="pb-3 border-b border-slate-100 flex items-start justify-between gap-2 relative">
            <div className="min-w-0 pr-8">
              <Logo companyName={companySettings?.name} logoUrl={companySettings?.logoUrl} tagline={companySettings?.tagline} />
            </div>
            <button
              type="button"
              onClick={() => setShowSidebar(false)}
              className="absolute right-0 top-1.5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all active:scale-95 border border-slate-150 shrink-0"
              title="Sembunyikan Menu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider px-3 mb-2">Navigasi</p>
            <nav className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('overview');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Analisis & Grafik"
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Analisis & Grafik</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('customers');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'customers'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Kelola Pelanggan"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Kelola Pelanggan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('payments');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left relative ${
                  activeTab === 'payments'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Verifikasi Bayar"
              >
                <div className="relative">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  {pendingPaymentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse md:hidden" />
                  )}
                </div>
                <span>Verifikasi Bayar</span>
                {pendingPaymentsCount > 0 && (
                  <span className={`ml-auto px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                    activeTab === 'payments' ? 'bg-white text-blue-600' : 'bg-red-100 text-red-600 animate-pulse'
                  }`}>
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('tickets');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left justify-between ${
                  activeTab === 'tickets'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Pesan Masuk & Gangguan"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Pesan & Tiket Gangguan</span>
                </div>
                {supportTickets.filter((t) => t.status === 'open').length > 0 && (
                  <span className={`relative flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full text-[9px] font-black tracking-tight animate-bounce ${
                    activeTab === 'tickets' ? 'bg-white text-blue-600 shadow-xs' : 'bg-red-500 text-white shadow-md shadow-red-500/30'
                  }`}>
                    {supportTickets.filter((t) => t.status === 'open').length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('packages');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'packages'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Kelola Paket WiFi"
              >
                <Wifi className="w-4 h-4 shrink-0" />
                <span>Kelola Paket WiFi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('company_settings');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'company_settings'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Pengaturan"
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Pengaturan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('coverage');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'coverage'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Kelola Area Cakupan"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Kelola Area Cakupan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('sheets_integration');
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'sheets_integration'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50'
                }`}
                title="Database & Google Sheets"
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Database & Google Sheets</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN PANEL */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Admin Header Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] bg-blue-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
              Sistem Kontrol Administrasi {(companySettings?.name || 'Patas.Net').toUpperCase()}
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-500" /> Dashboard Portal Admin WiFi
            </h1>
            <p className="text-[11px] text-slate-400">Kelola pelanggan, kirim pengingat tagihan WhatsApp, pantau grafik harian, & unduh laporan Excel.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {!showSidebar && (
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 text-[11px] shadow-lg shadow-blue-500/20 active:scale-95"
                title="Tampilkan Menu Samping"
              >
                <ChevronsRight className="w-4 h-4" />
                <span>Tampilkan Menu</span>
              </button>
            )}

            <div 
              className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800/90 border border-slate-700/70 rounded-xl text-[10px] select-none transition-all duration-300 shrink-0"
              title="Sistem Sinkronisasi otomatis database setiap 30 detik ke Google Sheets & Backend"
            >
              {sheetSyncState === 'syncing' ? (
                <div className="relative flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                </div>
              ) : (
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
              )}
              <div className="text-left leading-none font-sans">
                <span className="text-slate-400 block text-[8px] uppercase tracking-wider font-extrabold">Auto-Sync (30s)</span>
                <span className={`font-black tracking-tight ${sheetSyncState === 'syncing' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {sheetSyncState === 'syncing' ? 'Menyinkronkan...' : `Tersambung (${lastSyncTime})`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => performDatabaseSync(true)}
              disabled={sheetSyncState === 'syncing'}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 text-[11px] disabled:opacity-50 shrink-0 active:scale-95"
              title="Bersihkan cache lokal & paksa tarik ulang database dari Google Sheets / Server"
            >
              <Database className={`w-4 h-4 ${sheetSyncState === 'syncing' ? 'animate-spin text-yellow-300' : ''}`} />
              <span>Refresh Database</span>
            </button>
            <button
              onClick={handleExportToExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 text-[11px]"
              title="Ekspor Transaksi Excel"
            >
              <Download className="w-4 h-4" /> <span className="hidden xs:inline">Ekspor Excel</span>
            </button>
            <button
              onClick={handleExportToPDF}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 text-[11px]"
              title="Ekspor Laporan Bulanan (PDF)"
            >
              <FileText className="w-4 h-4" /> <span className="hidden xs:inline">Laporan Bulanan (PDF)</span>
            </button>
          </div>
        </div>

        {/* Tabs Content Wrapper */}
        <div className="space-y-8">
        {/* TAB 1: OVERVIEW & REAL-TIME REVENUE ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Quick stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Pendapatan Terverifikasi</span>
                <p className="text-xl sm:text-2xl font-black text-blue-600 font-mono">Rp {totalRevenue.toLocaleString('id-ID')}</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                  <TrendingUp className="w-3.5 h-3.5" /> Real-time Revenue
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pelanggan Aktif</span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">{activeCustomers}</p>
                <p className="text-[10px] text-emerald-500">Koneksi Fiber Terpasang</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Antrean Pasang Baru (Pending)</span>
                <p className="text-xl sm:text-2xl font-black text-amber-500 font-mono">{pendingCustomers}</p>
                <p className="text-[10px] text-slate-400">Menunggu Verifikasi & Teknisi</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Akun Terisolir (Suspended)</span>
                <p className="text-xl sm:text-2xl font-black text-red-500 font-mono">{suspendedCustomers}</p>
                <p className="text-[10px] text-slate-400">Layanan ditangguhkan sementara</p>
              </div>
            </div>

            {/* Visual Analytics charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Daily Revenue Chart */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Pendapatan Harian (15 Hari Terakhir)
                  </h3>
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-extrabold font-mono">Real-time</span>
                </div>

                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenueHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `Rp ${v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k'}`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`Rp ${value.toLocaleString('id-ID')}`, 'Pendapatan']}
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Package Distribution Chart */}
              <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-4 flex flex-col justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  Distribusi Paket WiFi
                </h3>

                {pieData.length > 0 ? (
                  <div className="space-y-4 my-auto">
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Manual Legend */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] max-h-24 overflow-y-auto">
                      {pieData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="truncate">{item.name} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 font-bold">
                    Belum ada data distribusi produk WiFi.
                  </div>
                )}
              </div>
            </div>

            {/* Simulated WhatsApp automatic notification logs */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-yellow-400">Log Pengiriman WhatsApp Gateway Otomatis</h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">Online</span>
              </div>
              <p className="text-[10px] text-slate-400">WhatsApp Gateway secara otomatis mengirimkan rincian status penagihan/verifikasi lunas kepada pelanggan. Berikut log real-time:</p>
              <div className="space-y-2 max-h-32 overflow-y-auto font-mono text-[10px] divide-y divide-slate-800/60">
                {waLogs.length > 0 ? (
                  waLogs.map((log) => (
                    <div key={log.id} className="py-2 first:pt-0">
                      <span className="text-slate-500">[{log.time}]</span> <span className="text-blue-400">{log.phone}:</span>{' '}
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-slate-500">Belum ada aktivitas pengiriman notifikasi WhatsApp otomatis.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DATA PELANGGAN & MAP GEOGRAPHICAL DISTRIBUTION */}
        {activeTab === 'customers' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* GIS Map plot panel */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden space-y-3">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-5 h-5 text-blue-600" /> Plot Geografis Pemasangan Pelanggan
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Memetakan semua titik koordinat pelanggan Taranet menggunakan Leaflet Map OpenStreetMap.</p>
                </div>
                {selectedUserForMap && (
                  <div className="bg-blue-50 text-blue-800 border border-blue-100 text-[10px] font-bold py-1 px-2.5 rounded-lg">
                    Fokus: {selectedUserForMap.name}
                  </div>
                )}
              </div>
              <div id="admin-customers-map" className="w-full h-80 z-10" style={{ minHeight: '320px' }} />
            </div>

            {/* Search and Database Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  Daftar Lengkap Pelanggan & Jalur WiFi
                </h3>
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (filteredCustomers.length === 0) return;
                      // Staggered trigger to prevent browser locks
                      filteredCustomers.forEach((c, idx) => {
                        setTimeout(() => {
                          generateCustomerPDFReport(c, supportTickets.filter((t) => t.userId === c.id), companySettings?.name);
                        }, idx * 300);
                      });
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-md shrink-0"
                    title="Cetak PDF Laporan Bulanan untuk Semua Pelanggan Terfilter"
                  >
                    <Download className="w-3.5 h-3.5" /> Cetak Laporan Massal ({filteredCustomers.length})
                  </button>
                  <div className="relative w-full sm:max-w-xs">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari nama, email atau telepon..."
                      className="w-full px-3 py-2 pl-9 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-slate-50/50"
                    />
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-3 px-4">Nama Pelanggan</th>
                      <th className="py-3 px-4">Paket & Biaya</th>
                      <th className="py-3 px-4">Dokumen KTP</th>
                      <th className="py-3 px-4">Kontak / Alamat</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Laporan PDF</th>
                      <th className="py-3 px-4 text-right">Aksi & Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((c) => {
                        const pkg = PACKAGES.find((p) => p.id === c.packageId) || PACKAGES[0];
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="py-4 px-4 font-bold text-slate-900">
                              <p className="text-sm">{c.name}</p>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {c.id}</span>
                            </td>
                            <td className="py-4 px-4 space-y-1">
                              <select
                                value={c.packageId}
                                onChange={(e) => {
                                  const newPkgId = e.target.value;
                                  const newPkgName = PACKAGES.find(p => p.id === newPkgId)?.name || newPkgId;
                                  setConfirmModal({
                                    show: true,
                                    title: 'Ubah Paket & Penyesuaian Tagihan',
                                    message: `Apakah Anda yakin ingin mengubah paket pelanggan "${c.name}" ke: ${newPkgName}? Tarif tagihan bulanan berjalan yang belum dibayar akan otomatis disesuaikan secara real-time.`,
                                    confirmText: 'Ya, Ubah Paket',
                                    variant: 'primary',
                                    onConfirm: async () => {
                                      await handleUpdateCustomerPackage(c.id, newPkgId);
                                      setSuccessToastMessage(`Paket ${c.name} berhasil diubah ke ${newPkgName} & tagihan disesuaikan!`);
                                      setTimeout(() => setSuccessToastMessage(null), 4000);
                                    }
                                  });
                                }}
                                className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white block focus:ring-2 focus:ring-blue-500 max-w-[170px]"
                                title="Ubah / Upgrade Paket Pelanggan"
                              >
                                {PACKAGES.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (Rp {p.price.toLocaleString('id-ID')})
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-blue-600 font-mono font-bold pl-1">Rp {pkg.price.toLocaleString('id-ID')}/bln</p>
                            </td>
                            <td className="py-4 px-4">
                              {c.ktpImageUrl ? (
                                <a
                                  href={c.ktpImageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
                                >
                                  Lihat KTP (Drive)
                                </a>
                              ) : (
                                <span className="text-slate-400">Tidak ada</span>
                              )}
                            </td>
                            <td className="py-4 px-4 space-y-1 max-w-[200px]">
                              <p className="font-mono text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                                <PhoneCall className="w-3 h-3 text-emerald-500" /> {c.phone}
                              </p>
                              <p className="truncate text-slate-500" title={c.address}>{c.address}</p>
                              <button
                                onClick={() => handleFocusOnMap(c)}
                                className="text-[9px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3 text-indigo-500" /> Lihat di Peta
                              </button>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase ${
                                c.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <button
                                type="button"
                                onClick={() => generateCustomerPDFReport(c, supportTickets.filter((t) => t.userId === c.id), companySettings?.name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-[10px] rounded-lg transition-all border border-slate-200/80 active:scale-95"
                                title="Cetak Laporan PDF untuk Pelanggan Ini"
                              >
                                <Download className="w-3 h-3 text-blue-600" /> Cetak PDF
                              </button>
                            </td>
                            <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                              <select
                                value={c.status}
                                onChange={async (e) => {
                                  await onUpdateCustomerStatus(c.id, e.target.value as any);
                                }}
                                className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white inline-block align-middle"
                              >
                                <option value="pending">Set Pending</option>
                                <option value="active">Set Active</option>
                                <option value="suspended">Set Suspended</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(c.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition inline-block align-middle"
                                title="Hapus Pelanggan"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                          Pelanggan tidak ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VERIFIKASI PEMBAYARAN TAGIHAN */}
        {activeTab === 'payments' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                Persetujuan Transaksi & Bukti Transfer Masuk
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-3 px-4">Pelanggan</th>
                      <th className="py-3 px-4">Periode Tagihan</th>
                      <th className="py-3 px-4">Jumlah</th>
                      <th className="py-3 px-4">Bukti Transaksi</th>
                      <th className="py-3 px-4">Metode & Tanggal</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {customers.flatMap((c) =>
                      c.payments.map((p) => ({ customer: c, payment: p }))
                    ).length > 0 ? (
                      customers.flatMap((c) =>
                        c.payments.map((p) => {
                          const hasProof = !!p.proofOfPaymentUrl;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-slate-900">{c.name}</p>
                                <p className="text-[10px] text-slate-400">{c.phone}</p>
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">{p.billingPeriod}</td>
                              <td className="py-3.5 px-4 font-bold text-blue-600 font-mono">Rp {p.amount.toLocaleString('id-ID')}</td>
                              <td className="py-3.5 px-4">
                                {hasProof ? (
                                  <a
                                    href={p.proofOfPaymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                                  >
                                    Lihat Bukti Transfer
                                  </a>
                                ) : (
                                  <span className="text-slate-400">Belum diunggah</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-slate-700 uppercase">{p.method || 'QRIS'}</p>
                                <p className="text-[10px] text-slate-400">{p.date}</p>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                                  p.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : p.status === 'pending_verification'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {p.status === 'pending_verification' && (
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await onVerifyPayment(c.id, p.id);
                                        logWhatsAppNotification(c.phone, c.name, p.billingPeriod, p.amount);
                                      }}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                    >
                                      <Check className="w-3 h-3" /> Setujui
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (onRejectPayment) {
                                          await onRejectPayment(c.id, p.id);
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 shadow-sm active:scale-95"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                )}
                                {p.status === 'paid' && (
                                  <span className="text-emerald-600 font-bold text-[10px]">Verified Lunas ✓</span>
                                )}
                                {p.status === 'unpaid' && (
                                  <div className="flex flex-col gap-1 items-end">
                                    <span className="text-slate-400 italic mb-1 text-[10px]">Menunggu Pembayaran</span>
                                    <div className="flex flex-col sm:flex-row gap-1 justify-end">
                                      <button
                                        type="button"
                                        disabled={sendingReminderId === `${p.id}-before_due`}
                                        onClick={() => handleSendWhatsAppReminder(c.id, p.id, 'before_due')}
                                        className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 font-bold text-[9px] rounded-md transition-colors border border-blue-200 whitespace-nowrap"
                                        title="Kirim pengingat WhatsApp sebelum jatuh tempo"
                                      >
                                        {sendingReminderId === `${p.id}-before_due` ? 'Mengirim...' : 'WA Sebelum Jatuh Tempo'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={sendingReminderId === `${p.id}-overdue`}
                                        onClick={() => handleSendWhatsAppReminder(c.id, p.id, 'overdue')}
                                        className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 font-bold text-[9px] rounded-md transition-colors border border-rose-200 whitespace-nowrap"
                                        title="Kirim peringatan keterlambatan pembayaran"
                                      >
                                        {sendingReminderId === `${p.id}-overdue` ? 'Mengirim...' : 'WA Keterlambatan'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                          Belum ada transaksi terekam.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMPLAINTS / GANGGUAN SUPPORT TICKETS */}
        {activeTab === 'tickets' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                Pesan Masuk, Hubungi Kami & Tiket Gangguan Pelanggan
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-3 px-4">Nama Pengirim</th>
                      <th className="py-3 px-4">Kontak</th>
                      <th className="py-3 px-4">Isi Pesan / Keluhan</th>
                      <th className="py-3 px-4">Tanggal Masuk</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {supportTickets.length > 0 ? (
                      supportTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{t.userName}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px]">{t.phone} <br /> <span className="text-slate-400 font-sans text-[10px]">{t.email}</span></td>
                          <td className="py-3.5 px-4 max-w-[300px] leading-relaxed text-slate-600">{t.message}</td>
                          <td className="py-3.5 px-4">{t.date}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase ${
                              t.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {t.status !== 'resolved' ? (
                              <button
                                onClick={() => handleResolveTicket(t.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] transition shadow-xs hover:shadow-md active:scale-95"
                              >
                                Selesaikan
                              </button>
                            ) : (
                              <span className="text-slate-400 font-bold text-[10px]">Selesai</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                          Tidak ada pesan masuk atau tiket keluhan saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: WIFI PACKAGES MANAGEMENT */}
        {activeTab === 'packages' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-blue-600" /> Kelola Paket Internet WiFi
              </h3>
              <p className="text-slate-500 leading-relaxed mt-2 text-xs">
                Tambah atau hapus paket layanan internet WiFi Anda secara real-time. Paket yang Anda kelola di sini akan langsung sinkron ke halaman depan, form pendaftaran pelanggan, serta menu pilihan paket berlangganan.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Tambah Paket */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" /> Tambah Paket WiFi Baru
                </h4>
                <form onSubmit={handleAddPackage} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[9px]">Nama Paket *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Taranet LITE 20 Mbps"
                      value={newPkgName}
                      onChange={(e) => setNewPkgName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase text-[9px]">Kecepatan *</label>
                      <input
                        type="text"
                        placeholder="Contoh: 20 Mbps"
                        value={newPkgSpeed}
                        onChange={(e) => setNewPkgSpeed(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase text-[9px]">Harga Bulanan (Rp) *</label>
                      <input
                        type="number"
                        placeholder="Contoh: 175000"
                        value={newPkgPrice}
                        onChange={(e) => setNewPkgPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase text-[9px]">Tipe Paket</label>
                      <select
                        value={newPkgType}
                        onChange={(e) => setNewPkgType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-blue-500 outline-none"
                      >
                        <option value="home">Rumah / Residensial</option>
                        <option value="business">Bisnis / Cafe / Kantor</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase text-[9px]">Rekomendasi / Populer?</label>
                      <div className="flex items-center h-8">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={newPkgPopular}
                            onChange={(e) => setNewPkgPopular(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <span>Ya, Pasang Lencana Populer</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[9px]">Fitur Layanan (Satu per baris atau pisahkan dengan koma)</label>
                    <textarea
                      rows={3}
                      placeholder="Contoh:&#10;100% Fiber Optik Unlimited&#10;Ideal untuk 3-5 perangkat&#10;Upload & Download Simetris"
                      value={newPkgFeatures}
                      onChange={(e) => setNewPkgFeatures(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-blue-500 outline-none resize-none font-mono text-[11px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={addingPackage}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-600/10 active:scale-[0.98]"
                  >
                    {addingPackage ? 'Menambahkan...' : 'Simpan Paket WiFi'}
                  </button>
                </form>
              </div>

              {/* Daftar Paket yang Ada */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Paket WiFi Terdaftar ({packages.length})
                  </h4>
                  {onRefreshPackages && (
                    <button
                      type="button"
                      onClick={() => onRefreshPackages()}
                      className="p-1 text-slate-400 hover:text-blue-600 transition"
                      title="Refresh"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`p-4 bg-white rounded-2xl border transition-all relative flex flex-col justify-between ${
                        pkg.popular
                          ? 'border-yellow-400 shadow-md shadow-yellow-400/5 bg-gradient-to-br from-white to-yellow-50/10'
                          : 'border-slate-200 shadow-sm hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase mb-1.5 ${
                              pkg.type === 'business' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {pkg.type === 'business' ? 'Bisnis' : 'Residensial'}
                            </span>
                            {pkg.popular && (
                              <span className="inline-block px-2 py-0.5 rounded bg-yellow-400 text-slate-900 text-[8px] font-extrabold uppercase ml-1">
                                Populer
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="text-slate-300 hover:text-red-600 p-1 rounded transition"
                            title="Hapus Paket"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <h5 className="font-extrabold text-sm text-slate-900 tracking-tight mt-1">
                          {pkg.name}
                        </h5>
                        <p className="text-xs text-slate-500 font-medium">Speed: {pkg.speed}</p>

                        <p className="font-extrabold text-sm text-blue-600 mt-2">
                          Rp {pkg.price.toLocaleString('id-ID')}<span className="text-[10px] font-normal text-slate-400">/bln</span>
                        </p>

                        <div className="mt-3 space-y-1.5 border-t border-slate-50 pt-2">
                          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">Fitur:</span>
                          {pkg.features && pkg.features.map((feat: string, fIdx: number) => (
                            <div key={fIdx} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: COMPANY SETTINGS */}
        {activeTab === 'company_settings' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" /> Pengaturan Identitas Perusahaan & WiFi
              </h3>
              <p className="text-slate-500 leading-relaxed mt-2 text-xs">
                Ubah nama perusahaan WiFi, alamat, serta identitas visual logo Anda di sini. Perubahan ini akan langsung diperbarui ke seluruh halaman web portal pelanggan, kuitansi PDF, dan notifikasi pesan otomatis.
              </p>
            </div>

            <form onSubmit={handleSaveCompanySettings} className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Nama Perusahaan WiFi</label>
                <input
                  type="text"
                  value={companyNameInput}
                  onChange={(e) => setCompanyNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                  placeholder="Contoh: Taranet WiFi"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Teks Logo Identitas Visual (Maksimal 2 Kata)</label>
                <input
                  type="text"
                  value={companyLogoTextInput}
                  onChange={(e) => setCompanyLogoTextInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                  placeholder="Contoh: TARANET"
                  required
                />
                <p className="text-[10px] text-slate-400">Kata kedua dalam logo otomatis dihiasi dengan warna biru profesional.</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Tagline Perusahaan (Di bawah Logo)</label>
                <input
                  type="text"
                  value={companyTaglineInput}
                  onChange={(e) => setCompanyTaglineInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                  placeholder="Contoh: ULTRA BROADBAND"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Alamat Perusahaan / Kantor WiFi</label>
                <textarea
                  rows={3}
                  value={companyAddressInput}
                  onChange={(e) => setCompanyAddressInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                  placeholder="Alamat lengkap kantor pusat..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Nomor WhatsApp Kontak Perusahaan (CS)</label>
                <input
                  type="text"
                  value={companyPhoneInput}
                  onChange={(e) => setCompanyPhoneInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                  placeholder="Contoh: +62 899-3299-977"
                  required
                />
                <p className="text-[10px] text-slate-400">Nomor ini digunakan di navigasi atas, footer, tombol live chat bantuan, serta notifikasi WhatsApp otomatis.</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Tanggal Jatuh Tempo Tagihan Bulanan (1 s.d 28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={companyBillingDateInput}
                  onChange={(e) => setCompanyBillingDateInput(Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 20)))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 bg-slate-50/50 font-bold"
                  placeholder="Contoh: 20"
                  required
                />
                <p className="text-[10px] text-slate-400">Menentukan batas tanggal jatuh tempo pembayaran bulanan pelanggan.</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[10px]">Upload Logo Perusahaan</label>
                <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  {companyLogoUrlInput ? (
                    <img src={companyLogoUrlInput} alt="Logo Preview" className="h-12 w-12 object-contain rounded border bg-white p-1" />
                  ) : (
                    <div className="h-12 w-12 rounded border bg-white flex items-center justify-center text-slate-300 text-xs font-bold font-sans">
                      LOGO
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCompanyLogoUrlInput(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-[9px] text-slate-400 mt-1">Gunakan format PNG/JPG dengan resolusi persegi/lanskap.</p>
                  </div>
                  {companyLogoUrlInput && (
                    <button
                      type="button"
                      onClick={() => setCompanyLogoUrlInput('')}
                      className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {savingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>

            {/* PROMO MANAGEMENT SECTION */}
            <div className="pt-8 border-t border-slate-100 space-y-6">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 flex items-center gap-2">
                  <Image className="w-5 h-5 text-indigo-600" /> Unggah & Kelola Promosi Perusahaan
                </h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Disini Anda bisa mengunggah gambar-gambar promo atau pamflet wifi Anda. Gambar ini akan langsung ditampilkan di halaman utama portal promosi pelanggan.
                </p>
              </div>

              {/* Form Upload Promo */}
              <form onSubmit={handleUploadPromo} className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl flex flex-col sm:flex-row items-center gap-4 max-w-xl">
                <div className="flex-1 w-full space-y-2">
                  <label className="block font-bold text-slate-700 uppercase text-[9px]">Pilih Gambar Promo Baru</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPromoImageBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-xs text-slate-500 w-full file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    required
                  />
                  {promoImageBase64 && (
                    <div className="mt-3 relative w-32 aspect-[4/3] rounded-xl border overflow-hidden bg-white">
                      <img src={promoImageBase64} alt="Promo Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPromoImageBase64('')}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 transition"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={uploadingPromo || !promoImageBase64}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition text-xs shrink-0 flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  {uploadingPromo ? 'Mengunggah...' : 'Unggah Promo'}
                </button>
              </form>

              {/* Promo Gallery Grid */}
              <div className="space-y-3">
                <h5 className="font-bold text-xs text-slate-800">Daftar Promo Aktif:</h5>
                {companySettings?.promos && companySettings.promos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {companySettings.promos.map((promo, idx) => (
                      <div key={idx} className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm aspect-[4/3]">
                        <img src={promo} alt={`Promo ${idx}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(idx)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105"
                            title="Hapus Promo"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 p-4 rounded-xl text-center">
                    Belum ada gambar promo terunggah. Silakan gunakan formulir di atas untuk mengunggah gambar promosi Anda.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: AREA COVERAGE AREA MANAGEMENT */}
        {activeTab === 'coverage' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" /> Pengaturan Area Jangkauan / Cakupan WiFi
              </h3>
              <p className="text-slate-500 leading-relaxed mt-2 text-xs">
                Kelola daerah jangkauan internet WiFi Anda secara dinamis. Anda bisa menambah kota/kabupaten baru, mendaftarkan kecamatan, hingga mengaktifkan kelurahan/desa beserta status nodenya.
              </p>
            </div>

            {/* FORM ADD CITY/KABUPATEN */}
            <form onSubmit={handleAddCity} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex flex-col sm:flex-row items-end gap-3 max-w-2xl">
              <div className="flex-1 space-y-1 w-full">
                <label className="block font-bold text-slate-700 uppercase text-[9px]">Nama Kota / Kabupaten Baru</label>
                <input
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  placeholder="Contoh: Depok, Bogor, Bekasi"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-blue-600 text-xs"
                  required
                />
              </div>
              <div className="space-y-1 w-full sm:w-40">
                <label className="block font-bold text-slate-700 uppercase text-[9px]">Tipe Wilayah</label>
                <select
                  value={newCityType}
                  onChange={(e) => setNewCityType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-blue-600 text-xs font-bold"
                >
                  <option value="Kota">Kota</option>
                  <option value="Kabupaten">Kabupaten</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs shrink-0"
              >
                Tambah Wilayah
              </button>
            </form>

            {loadingCoverage ? (
              <div className="py-12 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Memuat database area cakupan...</span>
              </div>
            ) : coverageList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
                Belum ada area cakupan terdaftar. Silakan tambah kota/kabupaten di atas.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {coverageList.map((city) => (
                  <div key={city.cityName} className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
                    {/* City Header */}
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                      <div>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wider mr-2">
                          {city.regionType}
                        </span>
                        <strong className="text-sm text-slate-800 uppercase tracking-tight">{city.cityName}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCity(city.cityName)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Kota/Kabupaten ini"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Form Add Kecamatan */}
                      <div className="flex gap-2 max-w-md">
                        <input
                          type="text"
                          placeholder="Masukkan nama Kecamatan baru..."
                          value={newKecName[city.cityName] || ''}
                          onChange={(e) => setNewKecName(prev => ({ ...prev, [city.cityName]: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-600 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddKecamatan(city.cityName)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition text-xs shrink-0"
                        >
                          Tambah Kec.
                        </button>
                      </div>

                      {/* Kecamatan List */}
                      {city.kecamatans && city.kecamatans.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {city.kecamatans.map((kec: any) => {
                            const kecKey = `${city.cityName}-${kec.name}`;
                            return (
                              <div key={kec.name} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                                  <strong className="text-slate-800 uppercase text-[10px]">Kecamatan {kec.name}</strong>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKecamatan(city.cityName, kec.name)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded transition"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Form Add Kelurahan */}
                                <div className="flex gap-1.5 mb-3">
                                  <input
                                    type="text"
                                    placeholder="Kelurahan baru..."
                                    value={newKelName[kecKey] || ''}
                                    onChange={(e) => setNewKelName(prev => ({ ...prev, [kecKey]: e.target.value }))}
                                    className="flex-1 px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-blue-600 text-[10px]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddKelurahan(city.cityName, kec.name)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[10px] shrink-0"
                                  >
                                    Tambah
                                  </button>
                                </div>

                                {/* Kelurahan Sub-list */}
                                {kec.kelurahans && kec.kelurahans.length > 0 ? (
                                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                    {kec.kelurahans.map((kel: any) => (
                                      <div key={kel.name} className="flex items-center justify-between px-2 py-1.5 bg-white border border-slate-200/50 rounded-lg text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                          <span className="text-slate-700 font-medium">{kel.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {kel.nodesCount || 0} Nodes
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteKelurahan(city.cityName, kec.name, kel.name)}
                                            className="p-0.5 text-slate-400 hover:text-red-500 transition"
                                          >
                                            <Trash className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic">Belum ada kelurahan terdaftar.</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed">
                          Belum ada kecamatan terdaftar. Silakan tambah di atas.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 8: GOOGLE SHEETS & DATABASE INTEGRATION */}
        {activeTab === 'sheets_integration' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Banner */}
            <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shrink-0 border border-blue-400/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Integrasi Google Sheets & Sinkronisasi Cloud</h2>
                    <p className="text-xs text-slate-300">
                      Sambungkan sistem WiFi ke Google Spreadsheet untuk penyimpanan cloud permanen & bagikan link yang tersinkron otomatis ke calon pelanggan.
                    </p>
                  </div>
                </div>

                {onOpenShareModal && (
                  <button
                    type="button"
                    onClick={onOpenShareModal}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Bagikan Link & QR Code</span>
                  </button>
                )}
              </div>
            </div>

            {/* Public Synchronized Link Info Card */}
            <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 border border-emerald-200/80 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Link Pendaftaran Calon Pelanggan (100% Tersinkron Belakang Layar)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full uppercase">
                  Siap Dibagikan
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Setiap calon pelanggan yang membuka link website Anda dari HP, laptop, atau tablet mana pun akan langsung mendapatkan <strong>branding nama perusahaan, logo, paket internet, promo, dan formulir pendaftaran</strong> yang sama persis dan selalu tersinkronisasi di belakang layar secara real-time.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={window.location.origin}
                  className="w-full sm:flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 shadow-inner"
                />
                {onOpenShareModal && (
                  <button
                    type="button"
                    onClick={onOpenShareModal}
                    className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Buka Opsi Bagikan & QR</span>
                  </button>
                )}
              </div>
            </div>

            {/* Success or Error Alert Message */}
            {syncSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-xs">Berhasil!</p>
                  <p className="text-xs font-medium">{syncSuccessMessage}</p>
                </div>
              </div>
            )}

            {syncErrorMessage && (
              <div className="p-5 bg-red-50 border border-red-200 rounded-3xl text-red-900 space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-sm text-red-900">Koneksi Google Apps Script Memerlukan Perhatian ("Resource not found")</h4>
                    <p className="text-xs text-red-700 mt-1 leading-relaxed whitespace-pre-line">
                      {syncErrorMessage}
                    </p>
                  </div>
                </div>

                {/* Step by Step Fix Guide Box */}
                <div className="p-4 bg-white rounded-2xl border border-red-200/80 space-y-3 text-xs text-slate-700">
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>💡 Cara Mengatasi Error "Resource not found" (1 Menit):</span>
                  </p>
                  <ol className="list-decimal pl-4 space-y-2 font-medium leading-relaxed">
                    <li>
                      <strong>Salin Kode Script Terbaru:</strong> Klik tombol hitam <strong>"Salin Kode Script"</strong> di bawah untuk mendapatkan kode Apps Script versi terbaru.
                    </li>
                    <li>
                      <strong>Buka Apps Script di Google Spreadsheet:</strong> Di Google Spreadsheet Anda, klik menu <strong>Extensions (Ekstensi)</strong> &rarr; <strong>Apps Script</strong>. Hapus isi lama dan tempel (Paste) kode yang telah disalin.
                    </li>
                    <li>
                      <strong>Buat Deployment Web App Baru:</strong> Klik tombol <strong>Deploy (Penerapan)</strong> biru di pojok kanan atas &rarr; Pilih <strong>New deployment (Penerapan Baru)</strong>.
                    </li>
                    <li>
                      <strong>Set Akses "Anyone" (Siapa Saja):</strong> Klik icon gerigi &rarr; Pilih <strong>Web app</strong>. Pada pilihan <strong>Who has access (Siapa yang memiliki akses)</strong>, Wajib pilih <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">Anyone (Siapa saja)</span>.
                    </li>
                    <li>
                      <strong>Salin & Tempel Web App URL Baru:</strong> Klik <strong>Deploy</strong>, izinkan akses akun Google, lalu salin Web App URL yang diberikan Google dan tempelkan ke kolom URL di bawah.
                    </li>
                  </ol>
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">Langkah cepat: klik tombol di samping untuk menyalin script terbaru:</span>
                    <button
                      type="button"
                      onClick={handleCopyAppsScriptCode}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                        copiedScript ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'Kode Terdisalin!' : 'Salin Kode Script'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Connection URL Input Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-slate-800 text-sm">URL Web App Google Apps Script</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                  appScriptUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {appScriptUrl ? 'URL Terhubung' : 'Belum Diatur'}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  TEMPEL URL WEB APP (https://script.google.com/macros/s/.../exec)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={appScriptUrl}
                    onChange={(e) => setAppScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 text-xs font-mono"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveAppScriptUrl()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan URL</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePingConnection}
                      disabled={syncLoading || !appScriptUrl}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      title="Uji koneksi ping ke Google Apps Script Web App"
                    >
                      {syncLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-emerald-400" />}
                      <span>Tes Koneksi</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Database Action Grid (The 3 primary buttons) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Button 1: Auto create sheets */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-sm">
                    1
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Buat Semua Sheet Otomatis</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Membuat & merapikan 7 lembar kerja (Pengaturan_Sistem, Pelanggan, Tagihan, Tiket, Paket, Cakupan, Testimoni) beserta header kolom warna biru/slate di Google Spreadsheet Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoCreateAllSheets}
                  disabled={syncLoading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 active:scale-95"
                >
                  {syncLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>1. Buat Semua Sheet Otomatis</span>
                </button>
              </div>

              {/* Button 2: Pull spreadsheet data */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">
                    2
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Tarik Data Spreadsheet</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Menarik ulang data paling baru dari Google Spreadsheet untuk menyinkronkan portal admin dengan perangkat/browser pelanggan lainnya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLinkAndSyncDatabase}
                  disabled={syncLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 active:scale-95"
                >
                  {syncLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>2. Tarik Data Spreadsheet</span>
                </button>
              </div>

              {/* Button 3: Manual backup */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-black text-sm">
                    3
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Cadangkan Data Sekarang</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Mengirimkan seluruh data saat ini (pelanggan, pembayaran, tiket gangguan, paket) ke Google Spreadsheet sebagai cadangan darurat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerManualBackup}
                  disabled={syncLoading}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 active:scale-95"
                >
                  {syncLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  <span>3. Cadangkan Data Sekarang</span>
                </button>
              </div>
            </div>

            {/* Detailed Log Viewer Component for Google Apps Script API Diagnostics */}
            <GasLogViewer webhookUrl={appScriptUrl} onRefreshData={handleLinkAndSyncDatabase} />

            {/* Google Apps Script Code Exporter & Tutorial Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" /> Script Google Apps Script (Kode Otomatis)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Salin kode di bawah ini lalu tempel di Google Spreadsheet Anda (Extensions &rarr; Apps Script).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAppsScriptCode}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 ${
                    copiedScript
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {copiedScript ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>{copiedScript ? 'Kode Berhasil Disalin!' : 'Salin Kode Apps Script'}</span>
                </button>
              </div>

              {/* Instructions Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="font-black text-blue-600 text-xs">Langkah 1:</span>
                  <p className="text-slate-600 font-medium">Buka Google Spreadsheet baru di browser Anda.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="font-black text-blue-600 text-xs">Langkah 2:</span>
                  <p className="text-slate-600 font-medium">Klik menu <strong>Extensions</strong> &rarr; <strong>Apps Script</strong>.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="font-black text-blue-600 text-xs">Langkah 3:</span>
                  <p className="text-slate-600 font-medium">Hapus semua isi lalu tempel (Paste) kode script di atas.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="font-black text-blue-600 text-xs">Langkah 4:</span>
                  <p className="text-slate-600 font-medium">Klik <strong>Deploy</strong> &rarr; <strong>New deployment</strong> &rarr; Set Who has access = <strong>Anyone</strong> (Siapa saja).</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Custom Confirmation Modal */}
    {confirmModal.show && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200 text-left">
          <div className="text-slate-800 space-y-2">
            <h3 className={`font-extrabold text-sm uppercase tracking-wide ${
              confirmModal.variant === 'primary'
                ? 'text-blue-600'
                : confirmModal.variant === 'success'
                  ? 'text-emerald-600'
                  : 'text-red-600'
            }`}>{confirmModal.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-bold">{confirmModal.message}</p>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={async () => {
                const currentConfirm = confirmModal.onConfirm;
                setConfirmModal(prev => ({ ...prev, show: false }));
                await currentConfirm();
              }}
              className={`px-4 py-2 text-white font-bold rounded-xl transition text-xs shadow-md ${
                confirmModal.variant === 'primary'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/15'
                  : confirmModal.variant === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/15'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/15'
              }`}
            >
              {confirmModal.confirmText || 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
