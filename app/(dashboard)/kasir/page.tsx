"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Receipt,
  Clock,
  Sun,
  Moon,
  History,
  CheckCircle2,
  X,
  Printer,
  RotateCcw,
  Save,
  FolderOpen,
  User,
  Tag,
  ChevronRight,
  AlertCircle,
  Check,
  LogOut,
  Store,
  Package,
  BarChart3,
  TrendingUp,
  Award,
  Edit3,
  SlidersHorizontal
} from 'lucide-react';

const CATEGORIES = ['Semua', 'Kopi', 'Non-Kopi', 'Makanan Berat', 'Camilan', 'Dessert'];
type DashboardTab = 'kasir' | 'produk' | 'laporan';

const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80';
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  isActive: boolean;
  available: boolean;
  customizable: boolean;
  customType: 'food' | 'drink';
  image: string;
  customImage?: string | null;
};

type ProductApiData = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  image: string | null;
};

type OrderApiData = {
  id: string;
  createdAt: string;
  total: number;
  payAmount: number;
  change: number;
  method: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    qty: number;
  }>;
};

type CartItem = {
  cartId: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  options: string;
  note: string;
};

type DraftOrder = {
  id: string;
  savedAt: string;
  orderType: 'Dine In' | 'Take Away';
  customerName: string;
  cart: CartItem[];
  discountType: 'percent' | 'nominal';
  discountValue: number;
  includeTax: boolean;
  total: number;
};

type ReceiptData = {
  id: string;
  timestamp: string;
  date: string;
  orderType: string;
  customerName: string;
  cashier: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  breakdownAvailable?: boolean;
  total: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
};

type ToastData = {
  message: string;
  type: string;
};

type TopSellingItem = {
  name: string;
  qty: number;
  revenue: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Helper format Rupiah presisi
const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Helper format tanggal & waktu Indonesia
const formatDateTime = (date: Date) => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return {
    dateStr: `${dayName}, ${day} ${month} ${year}`,
    timeStr: `${hours}:${minutes}:${seconds}`
  };
};

export default function App() {
  // --- NAVIGASI & TEMA ---
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const requestedTab = searchParams.get('tab');
  const activeNav: DashboardTab =
    requestedTab === 'produk' || requestedTab === 'laporan' ? requestedTab : 'kasir';
  const setActiveNav = useCallback(
    (tab: DashboardTab) => {
      const params = new URLSearchParams(searchParamsString);
      if (tab === 'kasir') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      router.replace(query ? `/kasir?${query}` : '/kasir', { scroll: false });
    },
    [router, searchParamsString]
  );
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- KATALOG & FILTER ---
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // --- KERANJANG & ORDER ---
  const [orderCounter, setOrderCounter] = useState(1);
  const [orderNumber, setOrderNumber] = useState('ORD-001');
  const [orderType, setOrderType] = useState<'Dine In' | 'Take Away'>('Dine In');
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- DISKON & PAJAK ---
  const [discountType, setDiscountType] = useState<'percent' | 'nominal'>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [includeTax, setIncludeTax] = useState(true); // PPN 11%

  // --- DRAFT PESANAN ---
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [showDraftModal, setShowDraftModal] = useState(false);

  // --- MODAL KUSTOMISASI ITEM ---
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [tempTempOption, setTempTempOption] = useState('Ice');
  const [tempSugarOption, setTempSugarOption] = useState('Normal Sugar');
  const [tempToppingOption, setTempToppingOption] = useState('Tanpa Topping');
  const [tempSpiceOption, setTempSpiceOption] = useState('Sedang');
  const [tempNote, setTempNote] = useState('');

  // --- MODAL PEMBAYARAN & STRUK ---
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Debit / Kartu'>('Tunai');
  const [cashReceived, setCashReceived] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [receiptIsHistorical, setReceiptIsHistorical] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // --- RIWAYAT TRANSAKSI ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transactions, setTransactions] = useState<ReceiptData[]>([]);

  // --- MODAL TAMBAH / EDIT PRODUK (HALAMAN PRODUK) ---
  const [showProductFormModal, setShowProductFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormCategory, setProdFormCategory] = useState('Kopi');
  const [prodFormPrice, setProdFormPrice] = useState('');
  const [prodFormStock, setProdFormStock] = useState('');
  const [prodFormImageFile, setProdFormImageFile] = useState<File | null>(null);
  const [prodFormImagePreview, setProdFormImagePreview] = useState<string | null>(null);
  const [removeProdFormImage, setRemoveProdFormImage] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  // --- TOAST & MOBILE DRAWER ---
  const [toast, setToast] = useState<ToastData | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prodFormImageInputRef = useRef<HTMLInputElement>(null);
  const prodFormImagePreviewRef = useRef<string | null>(null);

  const clearProductImagePreview = useCallback(() => {
    if (prodFormImagePreviewRef.current) {
      URL.revokeObjectURL(prodFormImagePreviewRef.current);
      prodFormImagePreviewRef.current = null;
    }
    setProdFormImagePreview(null);
  }, []);

  const updateProductFormImage = useCallback(
    (file: File | null) => {
      clearProductImagePreview();
      setProdFormImageFile(file);
      if (file) {
        const previewUrl = URL.createObjectURL(file);
        prodFormImagePreviewRef.current = previewUrl;
        setProdFormImagePreview(previewUrl);
      }
    },
    [clearProductImagePreview]
  );

  const closeProductFormModal = useCallback(() => {
    setShowProductFormModal(false);
    updateProductFormImage(null);
    setRemoveProdFormImage(false);
    if (prodFormImageInputRef.current) prodFormImageInputRef.current.value = '';
  }, [updateProductFormImage]);

  const closeReceipt = useCallback(() => {
    setCompletedReceipt(null);
    if (!receiptIsHistorical) {
      const nextNum = orderCounter + 1;
      setOrderCounter(nextNum);
      setOrderNumber(`ORD-${String(nextNum).padStart(3, '0')}`);
      setCart([]);
      setDiscountValue(0);
      setCustomerName('');
    }
    setReceiptIsHistorical(false);
  }, [orderCounter, receiptIsHistorical]);

  // Update jam real-time setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (prodFormImagePreviewRef.current) {
        URL.revokeObjectURL(prodFormImagePreviewRef.current);
      }
    },
    []
  );

  // Shortcut keyboard `/` untuk fokus search bar & `Escape` tutup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (activeNav !== 'kasir') setActiveNav('kasir');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        if (completedReceipt) {
          closeReceipt();
          return;
        }
        setCustomizingProduct(null);
        setShowPaymentModal(false);
        setShowHistoryModal(false);
        setShowDraftModal(false);
        closeProductFormModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNav, closeProductFormModal, closeReceipt, completedReceipt, setActiveNav]);

  const triggerToast = useCallback((message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?includeInactive=true');
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Gagal memuat produk'
        );
      }
      if (!Array.isArray(data)) {
        throw new Error('Format data produk tidak valid');
      }

      setProducts((data as ProductApiData[]).map((product) => ({
        ...product,
        category: product.category || 'Umum',
        available: product.isActive,
        customizable:
          product.category === 'Kopi' ||
          product.category === 'Non-Kopi' ||
          product.category === 'Makanan Berat' ||
          product.category === 'Camilan',
        customType:
          product.category === 'Makanan Berat' || product.category === 'Camilan'
            ? 'food'
            : 'drink',
        customImage: product.image,
        image: product.image || DEFAULT_PRODUCT_IMAGE
      })));
    } catch (error) {
      console.error('Gagal mengambil produk', error);
      triggerToast(error instanceof Error ? error.message : 'Gagal memuat produk', 'error');
    }
  }, [triggerToast]);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch('/api/orders');
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Gagal memuat riwayat transaksi'
        );
      }
      if (!Array.isArray(data)) {
        throw new Error('Format riwayat transaksi tidak valid');
      }

      setTransactions((data as OrderApiData[]).map((order) => {
        const date = new Date(order.createdAt);
        const { dateStr, timeStr } = formatDateTime(date);
        const items = order.items.map((item, index) => ({
          cartId: `${order.id}-${index}`,
          productId: item.productId,
          name: item.name,
          image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
          price: item.price,
          qty: item.qty,
          options: '',
          note: ''
        }));

        return {
          id: order.id,
          timestamp: timeStr,
          date: dateStr,
          orderType: 'Dine In',
          customerName: 'Pelanggan Umum',
          cashier: 'Kasir',
          items,
          subtotal: order.total,
          discountAmount: 0,
          taxAmount: 0,
          breakdownAvailable: false,
          total: order.total,
          paymentMethod: order.method === 'qris' ? 'QRIS' : order.method === 'card' ? 'Debit / Kartu' : 'Tunai',
          cashReceived: order.payAmount,
          change: order.change
        };
      }));
    } catch (error) {
      console.error('Gagal mengambil riwayat transaksi', error);
      triggerToast(
        error instanceof Error ? error.message : 'Gagal memuat riwayat transaksi',
        'error'
      );
    }
  }, [triggerToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProducts();
      void fetchTransactions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, fetchTransactions]);

  // --- HITUNG JUMLAH ITEM PER KATEGORI ---
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: products.length };
    CATEGORIES.slice(1).forEach((cat) => {
      counts[cat] = products.filter((p) => p.category === cat).length;
    });
    return counts;
  }, [products]);

  // --- FILTER KATALOG PRODUK ---
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // --- KALKULASI KERANJANG ---
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (subtotal === 0) return 0;
    if (discountType === 'percent') {
      const pct = Math.min(Math.max(Number(discountValue) || 0, 0), 100);
      return Math.round((subtotal * pct) / 100);
    }
    return Math.round(Math.min(Math.max(Number(discountValue) || 0, 0), subtotal));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = includeTax ? Math.round(afterDiscount * 0.11) : 0;
  const grandTotal = afterDiscount + taxAmount;

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // --- AKSI PRODUK & KERANJANG ---
  const handleProductClick = (product: Product) => {
    if (!product.available || product.stock <= 0) {
      triggerToast('Menu sedang tidak tersedia / stok habis!', 'error');
      return;
    }

    if (product.customizable) {
      setCustomizingProduct(product);
      setTempTempOption('Ice');
      setTempSugarOption('Normal Sugar');
      setTempToppingOption('Tanpa Topping');
      setTempSpiceOption('Sedang');
      setTempNote('');
    } else {
      addItemToCart(product, '', '', 0);
    }
  };

  const addItemToCart = (
    product: Product,
    optionsStr = '',
    noteStr = '',
    extraPrice = 0
  ) => {
    const existingQtyInCart = cart
      .filter((c) => c.productId === product.id)
      .reduce((acc, cur) => acc + cur.qty, 0);

    if (existingQtyInCart + 1 > product.stock) {
      triggerToast(`Stok ${product.name} hanya tersisa ${product.stock}!`, 'error');
      return;
    }

    const finalUnitPrice = product.price + extraPrice;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          item.options === optionsStr &&
          item.note === noteStr &&
          item.price === finalUnitPrice
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      }

      return [
        ...prev,
        {
          cartId: `CART-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: product.id,
          name: product.name,
          image: product.image,
          price: finalUnitPrice,
          qty: 1,
          options: optionsStr,
          note: noteStr
        }
      ];
    });

    triggerToast(`+1 ${product.name} masuk keranjang`);
  };

  const confirmCustomProduct = () => {
    if (!customizingProduct) return;
    let optionsStr = '';
    let extraPrice = 0;

    if (customizingProduct.customType === 'food') {
      optionsStr = `Pedas: ${tempSpiceOption}`;
    } else {
      const toppingPart =
        tempToppingOption !== 'Tanpa Topping' ? ` • ${tempToppingOption}` : '';
      optionsStr = `${tempTempOption} • ${tempSugarOption}${toppingPart}`;
      if (tempToppingOption === 'Extra Espresso (+5k)') extraPrice = 5000;
      if (tempToppingOption === 'Oat Milk (+6k)') extraPrice = 6000;
    }

    addItemToCart(customizingProduct, optionsStr, tempNote.trim(), extraPrice);
    setCustomizingProduct(null);
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId !== cartId) return item;
          const product = products.find((p) => p.id === item.productId);
          const totalOtherQty = prev
            .filter((c) => c.productId === item.productId && c.cartId !== cartId)
            .reduce((s, c) => s + c.qty, 0);

          const nextQty = item.qty + delta;
          if (product && nextQty + totalOtherQty > product.stock) {
            triggerToast(`Maksimal stok ${product.stock} item`, 'error');
            return item;
          }
          return { ...item, qty: nextQty };
        })
        .filter((item) => item.qty > 0)
    );
  };

  const removeCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const resetCart = () => {
    if (cart.length === 0 && !customerName && discountValue === 0) return;
    setCart([]);
    setDiscountValue(0);
    setCustomerName('');
    triggerToast('Keranjang berhasil direset', 'info');
  };

  // --- SIMPAN & MUAT DRAFT ---
  const saveToDraft = () => {
    if (cart.length === 0) {
      triggerToast('Keranjang masih kosong untuk disimpan ke Draft', 'error');
      return;
    }
    const newDraft = {
      id: orderNumber,
      savedAt: formatDateTime(new Date()).timeStr,
      orderType,
      customerName: customerName.trim() || 'Pelanggan Umum',
      cart: [...cart],
      discountType,
      discountValue,
      includeTax,
      total: grandTotal
    };
    setDraftOrders((prev) => [newDraft, ...prev]);
    const nextNum = orderCounter + 1;
    setOrderCounter(nextNum);
    setOrderNumber(`ORD-${String(nextNum).padStart(3, '0')}`);
    setCart([]);
    setDiscountValue(0);
    setCustomerName('');
    triggerToast(`Pesanan #${newDraft.id} disimpan ke Draft`);
  };

  const loadDraft = (draft: DraftOrder) => {
    setOrderNumber(draft.id);
    setOrderType(draft.orderType);
    setCustomerName(draft.customerName === 'Pelanggan Umum' ? '' : draft.customerName);
    setCart(draft.cart);
    setDiscountType(draft.discountType);
    setDiscountValue(draft.discountValue);
    setIncludeTax(draft.includeTax);
    setDraftOrders((prev) => prev.filter((d) => d.id !== draft.id));
    setShowDraftModal(false);
    setActiveNav('kasir');
    triggerToast(`Draft #${draft.id} dipulihkan`);
  };

  // --- PEMBAYARAN & CETAK STRUK ---
  const openPayment = () => {
    if (cart.length === 0) {
      triggerToast('Pilih minimal 1 menu terlebih dahulu!', 'error');
      return;
    }
    setPaymentMethod('Tunai');
    setCashReceived('');
    setShowPaymentModal(true);
  };

  const numericCash = Number(String(cashReceived).replace(/\D/g, '')) || 0;
  const changeAmount = paymentMethod === 'Tunai' ? Math.max(numericCash - grandTotal, 0) : 0;
  const isPaymentValid =
    paymentMethod !== 'Tunai' || (numericCash >= grandTotal && grandTotal > 0);

  const handleConfirmPayment = async () => {
    if (!isPaymentValid) return;
    if (isSavingPayment) return;
    setIsSavingPayment(true);

    try {
      const method =
        paymentMethod === 'Tunai' ? 'cash' : paymentMethod === 'QRIS' ? 'qris' : 'card';
      const normalizedDiscountValue =
        discountType === 'percent'
          ? Math.min(Math.max(Number(discountValue) || 0, 0), 100)
          : Math.min(Math.max(Math.round(Number(discountValue) || 0), 0), subtotal);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          payAmount: paymentMethod === 'Tunai' ? numericCash : grandTotal,
          discountType,
          discountValue: normalizedDiscountValue,
          includeTax,
          items: cart.map((item) => ({
            id: item.productId,
            qty: item.qty,
            price: item.price,
            options: item.options
          }))
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'Gagal menyimpan transaksi'
        );
      }
      if (!isRecord(result) || !isRecord(result.order)) {
        throw new Error('Respons transaksi tidak valid');
      }

      const order = result.order as unknown as OrderApiData;
      const { timeStr, dateStr } = formatDateTime(new Date(order.createdAt));
      const receiptData = {
        id: order.id,
        timestamp: timeStr,
        date: dateStr,
        orderType,
        customerName: customerName.trim() || 'Pelanggan Umum',
        cashier: 'Kasir',
        items: [...cart],
        subtotal: Number(result.subtotal),
        discountAmount: Number(result.discountAmount),
        taxAmount: Number(result.taxAmount),
        breakdownAvailable: true,
        total: order.total,
        paymentMethod,
        cashReceived: order.payAmount,
        change: order.change
      };

      setTransactions((prev) => [receiptData, ...prev]);
      setShowPaymentModal(false);
      setReceiptIsHistorical(false);
      setCompletedReceipt(receiptData);
      setMobileCartOpen(false);
      triggerToast(`Pembayaran #${receiptData.id} berhasil!`);
      void fetchProducts();
    } catch (error) {
      console.error('Gagal memproses pembayaran', error);
      triggerToast(
        error instanceof Error ? error.message : 'Gagal menyimpan transaksi',
        'error'
      );
    } finally {
      setIsSavingPayment(false);
    }
  };

  const startNewTransaction = () => {
    const nextNum = orderCounter + 1;
    setOrderCounter(nextNum);
    setOrderNumber(`ORD-${String(nextNum).padStart(3, '0')}`);
    setCart([]);
    setDiscountValue(0);
    setCustomerName('');
    setReceiptIsHistorical(false);
    setCompletedReceipt(null);
  };

  // --- MANAJEMEN PRODUK (HALAMAN PRODUK) ---
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdFormName('');
    setProdFormCategory('Kopi');
    setProdFormPrice('');
    setProdFormStock('20');
    updateProductFormImage(null);
    setRemoveProdFormImage(false);
    if (prodFormImageInputRef.current) prodFormImageInputRef.current.value = '';
    setShowProductFormModal(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdFormName(product.name);
    setProdFormCategory(product.category);
    setProdFormPrice(String(product.price));
    setProdFormStock(String(product.stock));
    updateProductFormImage(null);
    setRemoveProdFormImage(false);
    if (prodFormImageInputRef.current) prodFormImageInputRef.current.value = '';
    setShowProductFormModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prodFormName.trim() || !prodFormPrice) {
      triggerToast('Nama menu dan harga wajib diisi!', 'error');
      return;
    }

    const price = Number(prodFormPrice);
    const stock = Number(prodFormStock);
    if (!Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(stock) || stock < 0) {
      triggerToast('Harga atau stok tidak valid', 'error');
      return;
    }

    setIsSavingProduct(true);
    try {
      const formData = new FormData();
      formData.set('name', prodFormName.trim());
      formData.set('category', prodFormCategory);
      formData.set('price', String(price));
      formData.set('stock', String(stock));
      if (prodFormImageFile) formData.set('image', prodFormImageFile);
      if (removeProdFormImage) formData.set('removeImage', 'true');

      const response = await fetch(
        editingProduct ? `/api/products/${editingProduct.id}` : '/api/products',
        {
          method: editingProduct ? 'PATCH' : 'POST',
          body: formData
        }
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'Gagal menyimpan produk'
        );
      }

      await fetchProducts();
      closeProductFormModal();
      triggerToast(editingProduct ? 'Menu berhasil diperbarui' : 'Menu baru berhasil ditambahkan');
    } catch (error) {
      console.error('Gagal menyimpan produk', error);
      triggerToast(error instanceof Error ? error.message : 'Gagal menyimpan produk', 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const adjustProductStock = async (productId: string, delta: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: Math.max(product.stock + delta, 0) })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'Gagal memperbarui stok'
        );
      }
      await fetchProducts();
    } catch (error) {
      console.error('Gagal memperbarui stok', error);
      triggerToast(error instanceof Error ? error.message : 'Gagal memperbarui stok', 'error');
    }
  };

  const toggleProductAvailability = async (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.available })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'Gagal memperbarui status produk'
        );
      }
      await fetchProducts();
    } catch (error) {
      console.error('Gagal memperbarui status produk', error);
      triggerToast(error instanceof Error ? error.message : 'Gagal memperbarui status produk', 'error');
    }
  };

  // --- ANALITIK LAPORAN PENJUALAN ---
  const dailyRevenue = useMemo(() => {
    return transactions.reduce((sum, trx) => sum + trx.total, 0);
  }, [transactions]);

  const totalSoldItems = useMemo(() => {
    return transactions.reduce(
      (sum, trx) => sum + trx.items.reduce((s, item) => s + item.qty, 0),
      0
    );
  }, [transactions]);

  const topSellingMenu = useMemo(() => {
    const map: Record<string, TopSellingItem> = {};
    transactions.forEach((trx) => {
      trx.items.forEach((item) => {
        if (!map[item.name]) {
          map[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        map[item.name].qty += item.qty;
        map[item.name].revenue += item.qty * item.price;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [transactions]);

  const { dateStr, timeStr } = formatDateTime(currentTime);

  return (
    <div
      className={`min-h-screen w-full font-sans antialiased transition-colors duration-200 flex flex-col lg:flex-row overflow-x-hidden ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* LOAD GOOGLE FONT PLUS JAKARTA SANS & PRINT STYLES */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        body, button, input, select, textarea {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 12px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all">
          <div
            className={`px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold border backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-rose-600/95 text-white border-rose-500'
                : toast.type === 'info'
                ? 'bg-slate-800/95 text-white border-slate-700'
                : 'bg-emerald-600/95 text-white border-emerald-500'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* =====================================================================
          KOLOM 1 (KIRI): SIDEBAR NAVIGASI & IDENTITAS TOKO
      ===================================================================== */}
      <aside
        className={`w-full lg:w-[220px] xl:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-r flex flex-row lg:flex-col justify-between p-3 sm:p-4 lg:py-6 z-20 ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/80'
        }`}
      >
        {/* Brand Identity & Menu Navigasi */}
        <div className="flex flex-row lg:flex-col items-center lg:items-stretch justify-between w-full gap-4 lg:gap-7">
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-xl bg-slate-950 dark:bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight">
                KasirKu <span className="text-indigo-600 dark:text-indigo-400">POS</span>
              </h1>
              <p className="text-[11px] font-medium text-slate-400">Warung Kopi</p>
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="flex flex-row lg:flex-col gap-1.5 sm:gap-2">
            {([
              { id: 'kasir', label: 'Kasir', icon: Store },
              { id: 'produk', label: 'Produk', icon: Package },
              { id: 'laporan', label: 'Laporan', icon: BarChart3 }
            ] as const).map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveNav(nav.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? darkMode
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950 text-white shadow-md shadow-slate-950/15'
                      : darkMode
                      ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profil Kasir Bawah Sidebar (Desktop) */}
        <div
          className={`hidden lg:flex items-center gap-3 p-3 rounded-2xl border ${
            darkMode
              ? 'bg-slate-950/80 border-slate-800'
              : 'bg-slate-50 border-slate-200/80'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
            AD
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">Kasir: Admin</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Online
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          KOLOM 2 (TENGAH): AREA UTAMA (KASIR / PRODUK / LAPORAN)
      ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-hidden">
        {/* TOP HEADER BAR */}
        <header
          className={`px-4 sm:px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 ${
            darkMode
              ? 'bg-slate-900/95 border-slate-800 backdrop-blur'
              : 'bg-white/95 border-slate-200/80 backdrop-blur'
          }`}
        >
          {/* Informasi kasir tanpa judul duplikat */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> Kasir: Admin
            </span>
            <span>•</span>
            <span className="hidden sm:inline">{dateStr}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Online
            </span>
          </div>

          {/* Jam Digital & Tombol Cepat */}
          <div className="flex items-center gap-2">
            {/* Jam Real-time WIB */}
            <div
              className={`hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums ${
                darkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                  : 'bg-slate-50 border-slate-200/80 text-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{timeStr} WIB</span>
            </div>

            {/* Tombol Draft */}
            <button
              onClick={() => setShowDraftModal(true)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              <span>Draft</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {draftOrders.length}
              </span>
            </button>

            {/* Tombol Riwayat */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Riwayat</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
                {transactions.length}
              </span>
            </button>

            {/* Toggle Dark / Light Mode */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50 shadow-2xs'
              }`}
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={`p-2 rounded-xl border transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50 shadow-2xs'
              }`}
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =================================================================
            VIEW A: HALAMAN KASIR (KATALOG MENU)
        ================================================================= */}
        {activeNav === 'kasir' && (
          <>
            {/* Search & Filter Kategori */}
            <div
              className={`px-4 sm:px-6 pt-4 pb-3 border-b space-y-3 ${
                darkMode
                  ? 'bg-slate-950 border-slate-800/80'
                  : 'bg-slate-50/90 border-slate-200/70'
              }`}
            >
              {/* Floating Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari menu... (Tekan '/' untuk mencari)"
                  className={`w-full pl-10 pr-16 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-all ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500'
                      : 'bg-white border-slate-200/80 text-slate-800 placeholder-slate-400 focus:border-indigo-600 shadow-xs'
                  }`}
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Hapus pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd
                    className={`hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    /
                  </kbd>
                )}
              </div>

              {/* Filter Kategori Pill Horizontal */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORIES.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                          : darkMode
                          ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                          : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100/80'
                      }`}
                    >
                      <span>{category}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {categoryCounts[category] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid Katalog Produk */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
              {filteredProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-bold text-sm">Menu tidak ditemukan</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Coba kata kunci lain atau pilih kategori Semua
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                  {filteredProducts.map((product) => {
                    const inCartQty = cart
                      .filter((c) => c.productId === product.id)
                      .reduce((sum, c) => sum + c.qty, 0);
                    const isUnavailable = !product.available || product.stock <= 0;

                    return (
                      <div
                        key={product.id}
                        onClick={() => !isUnavailable && handleProductClick(product)}
                        className={`group relative rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-150 select-none ${
                          isUnavailable
                            ? 'opacity-55 cursor-not-allowed'
                            : 'cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md'
                        } ${
                          darkMode
                            ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/60'
                            : 'bg-white border-slate-200/80 hover:border-indigo-500/60 shadow-2xs'
                        }`}
                      >
                        {/* Thumbnail Produk */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                          <img
                            src={product.image}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Badge Kategori */}
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950/75 text-white backdrop-blur-xs">
                            {product.category}
                          </span>

                          {/* Badge Custom */}
                          {product.customizable && !isUnavailable && (
                            <span className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-600/90 text-white backdrop-blur-xs flex items-center gap-1">
                              <SlidersHorizontal className="w-2.5 h-2.5" /> Varian
                            </span>
                          )}

                          {/* Badge Qty di Keranjang */}
                          {inCartQty > 0 && (
                            <span className="absolute top-2.5 right-2.5 min-w-[24px] h-6 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center shadow-md">
                              {inCartQty}
                            </span>
                          )}

                          {/* Overlay Habis */}
                          {isUnavailable && (
                            <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center">
                              <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold uppercase tracking-wider">
                                {product.stock <= 0 ? 'Stok Habis' : 'Nonaktif'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Detail Teks Produk */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                              Stok:{' '}
                              <span
                                className={
                                  product.stock <= 5
                                    ? 'text-amber-500 font-bold'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                              >
                                {product.stock}
                              </span>
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                              {formatRupiah(product.price)}
                            </span>
                            <button
                              type="button"
                              disabled={isUnavailable}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductClick(product);
                              }}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                isUnavailable
                                  ? 'bg-slate-200 text-slate-400'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/15 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white'
                              }`}
                              aria-label={`Tambah ${product.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </>
        )}

        {/* =================================================================
            VIEW B: HALAMAN MANAJEMEN PRODUK & STOK
        ================================================================= */}
        {activeNav === 'produk' && (
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-lg sm:text-xl">Manajemen Produk & Stok</h2>
                <p className="text-xs text-slate-400">
                  Kelola daftar menu, tambah item baru, atau atur stok real-time
                </p>
              </div>
              <button
                onClick={openAddProductModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/25"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk Baru</span>
              </button>
            </div>

            <div
              className={`rounded-2xl border overflow-hidden ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                        darkMode
                          ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                          : 'bg-slate-50 border-slate-200/80 text-slate-500'
                      }`}
                    >
                      <th className="py-3.5 px-4">Menu</th>
                      <th className="py-3.5 px-4">Kategori</th>
                      <th className="py-3.5 px-4">Harga</th>
                      <th className="py-3.5 px-4">Stok Real-time</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs sm:text-sm">
                    {products.map((prod) => (
                      <tr
                        key={prod.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-10 h-10 rounded-xl object-cover shrink-0"
                            />
                            <div>
                              <p className="font-bold">{prod.name}</p>
                              <p className="text-[11px] text-slate-400">{prod.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          {formatRupiah(prod.price)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustProductStock(prod.id, -1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-extrabold">{prod.stock}</span>
                            <button
                              onClick={() => adjustProductStock(prod.id, 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleProductAvailability(prod.id)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                              prod.available && prod.stock > 0
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {prod.available && prod.stock > 0 ? '● Tersedia' : '● Nonaktif'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openEditProductModal(prod)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* =================================================================
            VIEW C: HALAMAN LAPORAN PENJUALAN
        ================================================================= */}
        {activeNav === 'laporan' && (
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl">Laporan Penjualan Shift</h2>
              <p className="text-xs text-slate-400">
                Ringkasan pendapatan, menu terlaris, dan daftar transaksi selesai
              </p>
            </div>

            {/* 3 Kartu KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className={`p-5 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Pendapatan</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                  {formatRupiah(dailyRevenue)}
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Transaksi Selesai</span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-2">{transactions.length} Order</p>
              </div>

              <div
                className={`p-5 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Item Terjual</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-2">{totalSoldItems} Cup / Porsi</p>
              </div>
            </div>

            {/* Menu Terlaris & Riwayat */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Menu Terlaris */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <h3 className="font-bold text-sm">Menu Terlaris Hari Ini</h3>
                {topSellingMenu.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Belum ada data penjualan. Selesaikan transaksi pertama di menu Kasir!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topSellingMenu.map((item, idx) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600/15 text-indigo-600 font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{item.qty} terjual</span>
                          <span className="text-slate-400 ml-2">
                            ({formatRupiah(item.revenue)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaksi Terakhir */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <h3 className="font-bold text-sm">Riwayat Transaksi Terbaru</h3>
                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Belum ada transaksi tercatat.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {transactions.map((trx) => (
                      <div
                        key={trx.id}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          darkMode
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs">
                            #{trx.id} • {trx.customerName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {trx.timestamp} • {trx.paymentMethod}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400">
                            {formatRupiah(trx.total)}
                          </span>
                          <button
                            onClick={() => {
                              setReceiptIsHistorical(true);
                              setCompletedReceipt(trx);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white transition-colors"
                          >
                            Struk
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        )}
      </div>

      {/* FLOATING CART BAR (KHUSUS MOBILE) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 z-30 pointer-events-none">
        <button
          onClick={() => setMobileCartOpen(true)}
          className="pointer-events-auto w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-between font-bold text-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <span>Pesanan #{orderNumber}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{formatRupiah(grandTotal)}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* =====================================================================
          KOLOM 3 (KANAN): PANEL KERANJANG & PEMBAYARAN
      ===================================================================== */}
      <aside
        className={`fixed inset-0 z-40 lg:static lg:z-auto w-full lg:w-[340px] xl:w-[375px] shrink-0 lg:h-screen flex flex-col border-l transition-transform duration-300 ${
          mobileCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200/80 text-slate-800'
        }`}
      >
        {/* Header Keranjang */}
        <div
          className={`p-4 border-b space-y-3 ${
            darkMode ? 'border-slate-800' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileCartOpen(false)}
                className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-extrabold text-base tracking-tight">#{orderNumber}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                {totalItemsCount} Item
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={saveToDraft}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-colors ${
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-800 text-amber-400'
                    : 'border-slate-200/80 hover:bg-amber-50 text-amber-600'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Draft</span>
              </button>
              <button
                onClick={resetCart}
                title="Reset Keranjang"
                className={`p-1.5 rounded-xl border transition-colors ${
                  darkMode
                    ? 'border-slate-700 hover:bg-rose-950/50 text-rose-400'
                    : 'border-slate-200/80 hover:bg-rose-50 text-rose-500'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Segmented Control Dine In / Take Away & Input Nama/Meja */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className={`grid grid-cols-2 p-1 rounded-xl border ${
                darkMode
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-100/90 border-slate-200/60'
              }`}
            >
              {(['Dine In', 'Take Away'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    orderType === type
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama / No. Meja"
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium outline-none transition-colors ${
                darkMode
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200/80 text-slate-800 placeholder-slate-400 focus:border-indigo-600'
              }`}
            />
          </div>
        </div>

        {/* Daftar Item Keranjang */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                  darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <ShoppingBag className="w-7 h-7" />
              </div>
              <p className="font-bold text-sm">Keranjang Masih Kosong</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[210px] leading-relaxed">
                Klik kartu produk di sebelah kiri untuk mulai mencatat pesanan pelanggan.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartId}
                className={`p-3 rounded-2xl border transition-all ${
                  darkMode
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-50/80 border-slate-200/80'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-xs sm:text-sm leading-tight truncate">
                        {item.name}
                      </h4>
                      <button
                        onClick={() => removeCartItem(item.cartId)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                        aria-label="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.options && (
                      <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {item.options}
                      </p>
                    )}
                    {item.note && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                        {item.note}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatRupiah(item.price)}
                    </p>
                  </div>
                </div>

                {/* Kontrol Qty & Total Harga Item */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQty(item.cartId, -1)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-extrabold text-xs">{item.qty}</span>
                    <button
                      onClick={() => updateCartQty(item.cartId, 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-extrabold text-xs sm:text-sm">
                    {formatRupiah(item.price * item.qty)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel Diskon, Kalkulasi & Tombol Bayar */}
        <div
          className={`p-4 border-t space-y-3 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
          }`}
        >
          {/* Diskon Promo Presisi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-500" /> Diskon Promo
              </span>
              <div className="flex items-center gap-1">
                {[0, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      setDiscountValue(pct);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      discountType === 'percent' && Number(discountValue) === pct
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : darkMode
                        ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        : 'border-slate-200/80 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pct === 0 ? 'Normal' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <select
                value={discountType}
                onChange={(e) => {
                  if (e.target.value === 'percent' || e.target.value === 'nominal') {
                    setDiscountType(e.target.value);
                  }
                  setDiscountValue(0);
                }}
                className={`col-span-5 px-2.5 py-2 rounded-xl border text-xs font-semibold outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-200'
                    : 'bg-slate-50 border-slate-200/80 text-slate-700'
                }`}
              >
                <option value="percent">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
              <div className="col-span-7 relative">
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  placeholder="0"
                  className={`w-full pl-3 pr-8 py-2 rounded-xl border text-xs text-right font-bold outline-none ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-200/80 text-slate-800 focus:border-indigo-600'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                  {discountType === 'percent' ? '%' : 'Rp'}
                </span>
              </div>
            </div>
          </div>

          {/* Rincian Angka */}
          <div className="space-y-1.5 pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {formatRupiah(subtotal)}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>
                  Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}
                </span>
                <span className="font-bold">- {formatRupiah(discountAmount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-500">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTax}
                  onChange={(e) => setIncludeTax(e.target.checked)}
                  className="rounded accent-indigo-600 w-3.5 h-3.5"
                />
                <span>PPN (11%)</span>
              </label>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {formatRupiah(taxAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
              <span className="font-extrabold text-sm">Total Tagihan</span>
              <span className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400">
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>

          {/* Tombol Bayar Sekarang */}
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              cart.length === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-lg shadow-indigo-600/25'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Bayar Sekarang</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MODAL 1: KUSTOMISASI VARIAN ITEM
      ===================================================================== */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={customizingProduct.image}
                  alt={customizingProduct.name}
                  className="w-14 h-14 rounded-xl object-cover"
                />
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {customizingProduct.category}
                  </span>
                  <h3 className="font-extrabold text-base">{customizingProduct.name}</h3>
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(customizingProduct.price)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customizingProduct.customType === 'food' ? (
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tingkat Kepedasan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Tidak Pedas', 'Sedang', 'Pedas Ekstra'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setTempSpiceOption(lvl)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                        tempSpiceOption === lvl
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : darkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Penyajian
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['Ice', 'Hot'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTempTempOption(opt)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          tempTempOption === opt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : darkMode
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {opt === 'Ice' ? 'Ice (Dingin)' : 'Hot (Panas)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Takaran Gula
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Normal Sugar', 'Less Sugar', 'No Sugar'].map((sugar) => (
                      <button
                        key={sugar}
                        type="button"
                        onClick={() => setTempSugarOption(sugar)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          tempSugarOption === sugar
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : darkMode
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {sugar}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Topping / Extra Shot
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      'Tanpa Topping',
                      'Extra Espresso (+5k)',
                      'Oat Milk (+6k)'
                    ].map((top) => (
                      <button
                        key={top}
                        type="button"
                        onClick={() => setTempToppingOption(top)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                          tempToppingOption === top
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : darkMode
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {top}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Catatan Khusus (Opsional)
              </label>
              <input
                type="text"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Contoh: Sedikit es, pisah gula..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                }`}
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmCustomProduct}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                + Tambah ke Pesanan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: PEMBAYARAN MODERN
      ===================================================================== */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-lg">Pembayaran Pesanan</h2>
                <p className="text-xs text-slate-400">
                  Order #{orderNumber} • {orderType}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Tagihan */}
            <div className="p-4 rounded-2xl bg-indigo-600 text-white flex items-center justify-between shadow-lg shadow-indigo-600/20">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-indigo-100 font-semibold">
                  Total Tagihan
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                  {formatRupiah(grandTotal)}
                </p>
              </div>
              <Receipt className="w-9 h-9 text-white/30" />
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {([
                  { id: 'Tunai', label: 'Tunai', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'Debit / Kartu', label: 'Debit / Kartu', icon: CreditCard }
                ] as const).map((method) => {
                  const Icon = method.icon;
                  const active = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : darkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-bold">{method.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail Input per Metode */}
            {paymentMethod === 'Tunai' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Uang Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                    className={`mt-1.5 w-full px-4 py-3 rounded-xl border text-lg font-extrabold outline-none ${
                      darkMode
                        ? 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  />
                </div>

                {/* Pecahan Uang Cepat */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(grandTotal))}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                  >
                    Uang Pas
                  </button>
                  {[20000, 50000, 100000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setCashReceived(String(nominal))}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {formatRupiah(nominal)}
                    </button>
                  ))}
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    numericCash >= grandTotal
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <span className="text-xs font-bold uppercase">
                    {numericCash >= grandTotal ? 'Kembalian' : 'Kurang Bayar'}
                  </span>
                  <span className="text-lg font-extrabold">
                    {numericCash >= grandTotal
                      ? formatRupiah(changeAmount)
                      : formatRupiah(Math.max(grandTotal - numericCash, 0))}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div
                className={`p-4 rounded-2xl border flex flex-col items-center text-center space-y-2.5 ${
                  darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                  <svg className="w-32 h-32 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="10" y="10" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                    <rect x="17" y="17" width="11" height="11" />
                    <rect x="65" y="10" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                    <rect x="72" y="17" width="11" height="11" />
                    <rect x="10" y="65" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                    <rect x="17" y="72" width="11" height="11" />
                    <rect x="42" y="12" width="6" height="6" />
                    <rect x="52" y="20" width="6" height="12" />
                    <rect x="42" y="36" width="16" height="6" />
                    <rect x="12" y="45" width="14" height="6" />
                    <rect x="34" y="48" width="10" height="10" />
                    <rect x="52" y="45" width="8" height="14" />
                    <rect x="68" y="44" width="20" height="6" />
                    <rect x="44" y="66" width="12" height="6" />
                    <rect x="64" y="64" width="10" height="10" />
                    <rect x="80" y="68" width="10" height="20" />
                    <rect x="46" y="80" width="18" height="8" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm">Scan QRIS KasirKu - Warung Kopi</p>
                  <p className="text-[11px] text-slate-400">
                    Nominal otomatis: {formatRupiah(grandTotal)}
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'Debit / Kartu' && (
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                  darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-600/15 text-indigo-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm">Tap / Masukkan Kartu pada EDC</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Klik konfirmasi setelah struk EDC berhasil keluar.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!isPaymentValid || isSavingPayment}
              onClick={handleConfirmPayment}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                isPaymentValid && !isSavingPayment
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSavingPayment ? (
                <span>Menyimpan transaksi...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi & Cetak Struk</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: STRUK THERMAL DIGITAL
      ===================================================================== */}
      {completedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeReceipt}
        >
          <div
            className="w-full max-w-sm space-y-4 my-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end print:hidden">
              <button
                type="button"
                onClick={closeReceipt}
                aria-label="Tutup struk"
                className="rounded-full bg-white p-2 text-slate-700 shadow-lg transition-colors hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              id="printable-receipt"
              className="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl font-mono text-xs space-y-4 border border-slate-200"
            >
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1 print:hidden">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base tracking-tight uppercase">
                  KasirKu - Warung Kopi
                </h3>
                <p className="text-[11px] text-slate-500">
                  Jl. Kopi Nusantara No. 12, Jakarta
                </p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Order:</span>
                  <span className="font-bold">#{completedReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu:</span>
                  <span>
                    {completedReceipt.date} {completedReceipt.timestamp}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan:</span>
                  <span>
                    {completedReceipt.customerName} ({completedReceipt.orderType})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span>{completedReceipt.cashier}</span>
                </div>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                {completedReceipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>
                        {item.qty}x {item.name}
                      </span>
                      <span>{formatRupiah(item.price * item.qty)}</span>
                    </div>
                    {item.options && (
                      <p className="text-[10px] text-slate-500 pl-3">- {item.options}</p>
                    )}
                    {item.note && (
                      <p className="text-[10px] text-slate-500 pl-3">* {item.note}</p>
                    )}
                  </div>
                ))}
              </div>

              {completedReceipt.breakdownAvailable !== false && (
                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span>{formatRupiah(completedReceipt.subtotal)}</span>
                  </div>
                  {completedReceipt.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Diskon</span>
                      <span>-{formatRupiah(completedReceipt.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">PPN (11%)</span>
                    <span>{formatRupiah(completedReceipt.taxAmount)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between font-extrabold text-sm border-b border-dashed border-slate-300 pb-3">
                <span>TOTAL</span>
                <span>{formatRupiah(completedReceipt.total)}</span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Bayar</span>
                  <span className="font-bold">{completedReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dibayar</span>
                  <span>{formatRupiah(completedReceipt.cashReceived)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembalian</span>
                  <span>{formatRupiah(completedReceipt.change)}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500">
                <p>Terima kasih sudah ngopi di KasirKu!</p>
                <p>WiFi: WarungKopi_Free</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 rounded-xl bg-white text-slate-800 hover:bg-slate-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={startNewTransaction}
                className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Pesanan Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: RIWAYAT TRANSAKSI CEPAT
      ===================================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl max-h-[85vh] rounded-2xl border flex flex-col shadow-2xl ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base sm:text-lg">Riwayat Transaksi</h2>
                <p className="text-xs text-slate-400">
                  Total Omzet: {formatRupiah(dailyRevenue)} ({transactions.length} transaksi)
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Belum ada transaksi yang selesai hari ini.
                </p>
              ) : (
                transactions.map((trx) => (
                  <div
                    key={trx.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      darkMode
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs sm:text-sm">#{trx.id}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {trx.paymentMethod}
                        </span>
                        <span className="text-[11px] text-slate-400">{trx.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {trx.customerName} ({trx.orderType})
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                        {formatRupiah(trx.total)}
                      </span>
                      <button
                        onClick={() => {
                          setShowHistoryModal(false);
                          setReceiptIsHistorical(true);
                          setCompletedReceipt(trx);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white transition-colors"
                      >
                        Struk
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: PESANAN DRAFT TERSIMPAN
      ===================================================================== */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base sm:text-lg">Draft Pesanan</h2>
              <button
                onClick={() => setShowDraftModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {draftOrders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Belum ada pesanan yang disimpan ke Draft.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {draftOrders.map((draft) => (
                  <div
                    key={draft.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs sm:text-sm">
                        #{draft.id} • {draft.customerName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {draft.cart.length} item • Disimpan {draft.savedAt}
                      </p>
                      <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                        {formatRupiah(draft.total)}
                      </p>
                    </div>
                    <button
                      onClick={() => loadDraft(draft)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                    >
                      Lanjutkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: FORM TAMBAH / EDIT PRODUK
      ===================================================================== */}
      {showProductFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className={`w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-2xl space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base sm:text-lg">
                {editingProduct ? 'Edit Menu' : 'Tambah Menu Baru'}
              </h2>
              <button
                type="button"
                onClick={closeProductFormModal}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 uppercase">Nama Menu</label>
                <input
                  type="text"
                  required
                  value={prodFormName}
                  onChange={(e) => setProdFormName(e.target.value)}
                  placeholder="Contoh: Es Kopi Klepon"
                  className={`mt-1 w-full px-3.5 py-2.5 rounded-xl border outline-none ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 uppercase">Gambar Menu (Opsional)</label>
                <div className="mt-1 flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <img
                    src={
                      prodFormImagePreview ??
                      (removeProdFormImage
                        ? DEFAULT_PRODUCT_IMAGE
                        : editingProduct?.customImage || DEFAULT_PRODUCT_IMAGE)
                    }
                    alt="Pratinjau gambar menu"
                    className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      ref={prodFormImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Pilih gambar menu"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (!file) return;
                        if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
                          triggerToast('Format gambar harus JPG, PNG, atau WEBP', 'error');
                          event.currentTarget.value = '';
                          return;
                        }
                        if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
                          triggerToast('Ukuran gambar maksimal 5 MB', 'error');
                          event.currentTarget.value = '';
                          return;
                        }
                        updateProductFormImage(file);
                        setRemoveProdFormImage(false);
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/10 dark:file:text-indigo-300"
                    />
                    <p className="mt-2 text-[10px] text-slate-400">
                      JPG, PNG, atau WEBP. Maksimal 5 MB.
                    </p>
                    {(prodFormImageFile || editingProduct?.customImage) && !removeProdFormImage && (
                      <button
                        type="button"
                        onClick={() => {
                          updateProductFormImage(null);
                          setRemoveProdFormImage(true);
                          if (prodFormImageInputRef.current) {
                            prodFormImageInputRef.current.value = '';
                          }
                        }}
                        className="mt-2 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Gunakan gambar default
                      </button>
                    )}
                    {removeProdFormImage && editingProduct?.customImage && (
                      <button
                        type="button"
                        onClick={() => setRemoveProdFormImage(false)}
                        className="mt-2 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Urungkan
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 uppercase">Kategori</label>
                  <select
                    value={prodFormCategory}
                    onChange={(e) => setProdFormCategory(e.target.value)}
                    className={`mt-1 w-full px-3 py-2.5 rounded-xl border outline-none ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {CATEGORIES.slice(1).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 uppercase">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodFormStock}
                    onChange={(e) => setProdFormStock(e.target.value)}
                    className={`mt-1 w-full px-3.5 py-2.5 rounded-xl border outline-none ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-400 uppercase">Harga (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={prodFormPrice}
                  onChange={(e) => setProdFormPrice(e.target.value)}
                  placeholder="15000"
                  className={`mt-1 w-full px-3.5 py-2.5 rounded-xl border outline-none ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeProductFormModal}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${
                  darkMode
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isSavingProduct}
              >
                {isSavingProduct ? 'Menyimpan...' : 'Simpan Menu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}