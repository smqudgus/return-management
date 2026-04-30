import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";

const PHOTO_BUCKET = "return-photos";
const SUPABASE_URL = "https://zseibbnawsmmuyiyatbq.supabase.co";

// 운영에서는 Vercel > Settings > Environment Variables의 VITE_SUPABASE_ANON_KEY 값을 우선 사용합니다.
// service_role / secret key는 절대 넣지 마세요.
const FALLBACK_SUPABASE_KEY = "sb_publishable_hV2je3UfybBDV1yR0PEkRw_9Qh76iVZ";

function getSupabaseKey() {
  const viteEnv = import.meta.env || {};
  const envKey = typeof viteEnv.VITE_SUPABASE_ANON_KEY === "string" ? viteEnv.VITE_SUPABASE_ANON_KEY.trim() : "";
  return envKey || FALLBACK_SUPABASE_KEY;
}

const SUPABASE_KEY = getSupabaseKey();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeFilePath(file) {
  const rawExtension = file && file.name && file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const extension = String(rawExtension || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  return `returns/${today()}/${makeId()}.${extension}`;
}

function createEmptyItem() {
  return {
    id: makeId(),
    itemName: "",
    quantity: "",
    unit: "개",
  };
}

function createEmptyForm() {
  return {
    receivedDate: today(),
    companyName: "",
    items: [createEmptyItem()],
    reason: "",
    receiver: "",
    photoFile: null,
    photoPreview: "",
    photoName: "",
  };
}

function splitTrailingQuantityUnit(text) {
  const cleanText = String(text || "").trim();
  const unit = cleanText.endsWith("박스") ? "박스" : cleanText.endsWith("개") ? "개" : "개";

  if (!cleanText.endsWith("박스") && !cleanText.endsWith("개")) {
    return { itemName: cleanText, quantity: "", unit };
  }

  const withoutUnit = cleanText.slice(0, cleanText.length - unit.length).trim();
  let index = withoutUnit.length - 1;

  while (index >= 0) {
    const char = withoutUnit[index];
    if ((char >= "0" && char <= "9") || char === ".") {
      index -= 1;
    } else {
      break;
    }
  }

  const itemName = withoutUnit.slice(0, index + 1).trim();
  const quantity = withoutUnit.slice(index + 1).trim();

  return {
    itemName: itemName || cleanText,
    quantity,
    unit,
  };
}

function parseBulkItemsText(text) {
  return String(text || "")
    .replace(/\r?\n/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const parsed = splitTrailingQuantityUnit(part);
      return {
        id: makeId(),
        itemName: parsed.itemName,
        quantity: parsed.quantity,
        unit: parsed.unit,
      };
    });
}

function dbRowToUi(row) {
  return {
    id: row.id,
    receivedDate: row.received_date,
    companyName: row.company_name,
    itemName: row.item_name,
    quantity: row.quantity || "",
    unit: row.quantity_unit || "개",
    reason: row.reason || "",
    receiver: row.receiver || "",
    photoUrl: row.photo_url || "",
    photoPath: row.photo_path || "",
    status: row.status,
    completedDate: row.completed_date || "",
    createdAt: row.created_at,
  };
}

function getFilteredRows(rows, view, keyword) {
  const cleanKeyword = keyword.trim().toLowerCase();

  return rows.filter((row) => {
    const byView = view === "all" ? true : row.status === view;
    const text = `${row.companyName || ""} ${row.itemName || ""} ${row.quantity || ""} ${row.unit || ""} ${row.reason || ""} ${row.receiver || ""}`.toLowerCase();
    const byKeyword = cleanKeyword ? text.includes(cleanKeyword) : true;
    return byView && byKeyword;
  });
}

function sortRowsByReceivedDate(rows, direction) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.receivedDate || "1900-01-01").getTime();
    const bTime = new Date(b.receivedDate || "1900-01-01").getTime();
    return direction === "asc" ? aTime - bTime : bTime - aTime;
  });
}

function truncateReason(reason, limit = 3) {
  const text = String(reason || "").trim();
  if (!text) return "-";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function Icon({ name, size = 18, className = "" }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const icons = {
    search: (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    upload: (
      <svg {...commonProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8 12 3 7 8" />
        <path d="M12 3v12" />
      </svg>
    ),
    check: (
      <svg {...commonProps}>
        <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    ),
    clock: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    plus: (
      <svg {...commonProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    image: (
      <svg {...commonProps}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </svg>
    ),
    trash: (
      <svg {...commonProps}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    ),
    rotate: (
      <svg {...commonProps}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v8h8" />
      </svg>
    ),
    refresh: (
      <svg {...commonProps}>
        <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    ),
  };

  return icons[name] || null;
}

function runSelfTests() {
  const sampleRows = [
    {
      id: "1",
      receivedDate: "2026-04-29",
      companyName: "카페아울렛",
      itemName: "PET 투명컵",
      quantity: "2",
      unit: "박스",
      reason: "파손",
      receiver: "김대리",
      status: "pending",
      completedDate: "",
    },
    {
      id: "2",
      receivedDate: "2026-04-29",
      companyName: "테스트카페",
      itemName: "컵뚜껑",
      quantity: "500",
      unit: "개",
      reason: "오배송",
      receiver: "이대리",
      status: "completed",
      completedDate: "2026-04-29",
    },
  ];

  const mapped = dbRowToUi({
    id: "abc",
    received_date: "2026-04-29",
    company_name: "A상사",
    item_name: "컵",
    quantity: "1",
    quantity_unit: "박스",
    reason: null,
    receiver: null,
    photo_url: null,
    photo_path: null,
    status: "pending",
    completed_date: null,
    created_at: "2026-04-29T00:00:00Z",
  });

  const parsedBulkItems = parseBulkItemsText("16온스페트컵 1박스, 종이컵 500개");
  const parsedLineBreakItems = parseBulkItemsText("컵뚜껑 2박스\n빨대 100개");

  console.assert(today().length === 10, "today() should return YYYY-MM-DD format");
  console.assert(SUPABASE_URL === "https://zseibbnawsmmuyiyatbq.supabase.co", "Supabase URL should be the corrected URL");
  console.assert(Boolean(SUPABASE_KEY) && SUPABASE_KEY.length > 20, "Supabase key should have fallback or env value");
  console.assert(getSupabaseKey().length > 20, "getSupabaseKey should return a usable key");
  console.assert(getFilteredRows(sampleRows, "pending", "").length === 1, "pending filter should return one row");
  console.assert(getFilteredRows(sampleRows, "completed", "").length === 1, "completed filter should return one row");
  console.assert(getFilteredRows(sampleRows, "all", "컵").length === 2, "keyword search should find matching rows");
  console.assert(getFilteredRows(sampleRows, "pending", "카페아울렛").length === 1, "keyword search should work with Korean text");
  console.assert(getFilteredRows(sampleRows, "pending", "없는검색어").length === 0, "unknown keyword should return empty results");
  console.assert(mapped.companyName === "A상사" && mapped.reason === "", "dbRowToUi should normalize database fields");
  console.assert(mapped.quantity === "1" && mapped.unit === "박스", "dbRowToUi should normalize quantity and unit fields");
  console.assert(parsedBulkItems.length === 2, "parseBulkItemsText should split comma-separated items");
  console.assert(parsedBulkItems[0].itemName === "16온스페트컵" && parsedBulkItems[0].quantity === "1" && parsedBulkItems[0].unit === "박스", "parseBulkItemsText should parse box quantity");
  console.assert(parsedBulkItems[1].itemName === "종이컵" && parsedBulkItems[1].quantity === "500" && parsedBulkItems[1].unit === "개", "parseBulkItemsText should parse piece quantity");
  console.assert(parsedLineBreakItems.length === 2, "parseBulkItemsText should split line breaks");
  console.assert(sortRowsByReceivedDate([{ id: "old", receivedDate: "2026-04-01" }, { id: "new", receivedDate: "2026-04-29" }], "desc")[0].id === "new", "date sort descending should put latest first");
  console.assert(sortRowsByReceivedDate([{ id: "old", receivedDate: "2026-04-01" }, { id: "new", receivedDate: "2026-04-29" }], "asc")[0].id === "old", "date sort ascending should put oldest first");
  console.assert(truncateReason("고객변심") === "고객변...", "truncateReason should shorten long reasons to 3 characters plus ellipsis");
  console.assert(truncateReason("파손") === "파손", "truncateReason should keep short reasons as-is");
  console.assert(truncateReason("") === "-", "truncateReason should show dash for empty reasons");
}

if (typeof window !== "undefined") {
  runSelfTests();
}

export default function ReturnManagementApp() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("pending");
  const [keyword, setKeyword] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [previewReason, setPreviewReason] = useState(null);
  const [previewText, setPreviewText] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [bulkItemsText, setBulkItemsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortDirection, setSortDirection] = useState("desc");
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const updateItem = (itemId, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItem = (itemId) => {
    setForm((prev) => {
      if (prev.items.length === 1) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
    });
  };

  const applyBulkItemsText = () => {
    const parsedItems = parseBulkItemsText(bulkItemsText);

    if (parsedItems.length === 0) {
      alert("빠른입력에 반품 품목을 입력해주세요. 예: 16온스페트컵 1박스, 종이컵 500개");
      return;
    }

    setForm((prev) => ({ ...prev, items: parsedItems }));
  };

  const loadRows = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("returns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(`반품 내역을 불러오지 못했습니다: ${error.message}`);
        return;
      }

      setRows((data || []).map(dbRowToUi));
    } catch (error) {
      setErrorMessage(`Supabase 연결 실패: ${error.message || "네트워크 요청이 차단되었습니다."}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const handlePhoto = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("사진은 8MB 이하로 올려주세요. 너무 큰 사진은 카카오톡/문자 전송 후 저장한 작은 이미지로 다시 시도해주세요.");
      return;
    }

    if (form.photoPreview) {
      URL.revokeObjectURL(form.photoPreview);
    }

    const preview = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, photoFile: file, photoPreview: preview, photoName: file.name }));
  };

  const uploadPhotoIfNeeded = async () => {
    if (!form.photoFile) return { photoUrl: "", photoPath: "", uploadWarning: "" };

    const photoPath = makeFilePath(form.photoFile);

    try {
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(photoPath, form.photoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: form.photoFile.type || "image/jpeg",
        });

      if (uploadError) {
        return {
          photoUrl: "",
          photoPath: "",
          uploadWarning: `사진 업로드 실패: ${uploadError.message}`,
        };
      }

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(photoPath);
      return { photoUrl: data.publicUrl, photoPath, uploadWarning: "" };
    } catch (error) {
      return {
        photoUrl: "",
        photoPath: "",
        uploadWarning: `사진 업로드 실패: ${error.message || "네트워크 또는 Storage 설정을 확인해주세요."}`,
      };
    }
  };

  const resetForm = () => {
    if (form.photoPreview) {
      URL.revokeObjectURL(form.photoPreview);
    }
    setForm(createEmptyForm());
    setBulkItemsText("");
  };

  const addRow = async (e) => {
    e.preventDefault();

    const validItems = form.items
      .map((item) => ({
        itemName: item.itemName.trim(),
        quantity: String(item.quantity || "").trim(),
        unit: item.unit || "개",
      }))
      .filter((item) => item.itemName);

    if (!form.companyName.trim() || validItems.length === 0) {
      alert("상호명과 물품명은 꼭 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const { photoUrl, photoPath, uploadWarning } = await uploadPhotoIfNeeded();

      const payload = validItems.map((item) => ({
        received_date: form.receivedDate,
        company_name: form.companyName.trim(),
        item_name: item.itemName,
        quantity: item.quantity || null,
        quantity_unit: item.unit,
        reason: form.reason.trim() || null,
        receiver: form.receiver.trim() || null,
        photo_url: photoUrl || null,
        photo_path: photoPath || null,
        status: "pending",
        completed_date: null,
      }));

      const { data, error } = await supabase
        .from("returns")
        .insert(payload)
        .select("*");

      if (error) throw new Error(error.message);

      setRows((prev) => [...(data || []).map(dbRowToUi), ...prev]);
      resetForm();
      setView("pending");

      if (uploadWarning) {
        setErrorMessage(`${uploadWarning} 반품 내역은 사진 없이 등록되었습니다. Supabase Storage의 return-photos 버킷과 정책을 확인해주세요.`);
      }
    } catch (error) {
      setErrorMessage(`반품 등록 실패: ${error.message || "Failed to fetch"}. Vercel의 VITE_SUPABASE_ANON_KEY 값 또는 Supabase DB 컬럼을 확인해주세요.`);
    } finally {
      setSaving(false);
    }
  };

  const completeRow = async (id) => {
    const completedDate = today();
    setErrorMessage("");

    const { data, error } = await supabase
      .from("returns")
      .update({ status: "completed", completed_date: completedDate, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      setErrorMessage(`완료 처리 실패: ${error.message}`);
      return;
    }

    setRows((prev) => prev.map((row) => (row.id === id ? dbRowToUi(data) : row)));
  };

  const restoreRow = async (id) => {
    setErrorMessage("");

    const { data, error } = await supabase
      .from("returns")
      .update({ status: "pending", completed_date: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      setErrorMessage(`되돌림 실패: ${error.message}`);
      return;
    }

    setRows((prev) => prev.map((row) => (row.id === id ? dbRowToUi(data) : row)));
  };

  const deleteRow = async (row) => {
    if (!confirm("이 반품 내역을 삭제할까요?")) return;

    setErrorMessage("");

    const { error } = await supabase.from("returns").delete().eq("id", row.id);

    if (error) {
      setErrorMessage(`삭제 실패: ${error.message}`);
      return;
    }

    if (row.photoPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([row.photoPath]);
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
  };

  const startEditRow = (row) => {
    setEditingRow(row);
    setEditForm({
      receivedDate: row.receivedDate || today(),
      companyName: row.companyName || "",
      itemName: row.itemName || "",
      quantity: row.quantity || "",
      unit: row.unit || "개",
      reason: row.reason || "",
      receiver: row.receiver || "",
    });
  };

  const cancelEditRow = () => {
    setEditingRow(null);
    setEditForm(null);
  };

  const saveEditRow = async () => {
    if (!editingRow || !editForm) return;

    if (!editForm.companyName.trim() || !editForm.itemName.trim()) {
      alert("상호명과 물품명은 꼭 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const payload = {
      received_date: editForm.receivedDate,
      company_name: editForm.companyName.trim(),
      item_name: editForm.itemName.trim(),
      quantity: String(editForm.quantity || "").trim() || null,
      quantity_unit: editForm.unit || "개",
      reason: editForm.reason.trim() || null,
      receiver: editForm.receiver.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("returns")
      .update(payload)
      .eq("id", editingRow.id)
      .select("*")
      .single();

    if (error) {
      setSaving(false);
      setErrorMessage(`수정 실패: ${error.message}`);
      return;
    }

    setRows((prev) => prev.map((row) => (row.id === editingRow.id ? dbRowToUi(data) : row)));
    setSaving(false);
    cancelEditRow();
  };

  const filteredRows = useMemo(() => sortRowsByReceivedDate(getFilteredRows(rows, view, keyword), sortDirection), [rows, view, keyword, sortDirection]);
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;

  return (
    <main className="min-h-screen w-full bg-[#f7f3ea] text-[#26231d] p-4 md:p-8 overflow-x-hidden">
      <div className="mx-auto w-full max-w-none">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 w-full rounded-[2rem] bg-[#fffaf0] border border-[#e8ddc8] shadow-sm p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-sm font-semibold text-[#d9792b] mb-2">RETURN MANAGEMENT</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">반품 접수 관리</h1>
              <p className="mt-3 text-[#6b6256] text-sm md:text-base">
                직원들이 입력한 반품 접수 내역과 사진이 Supabase DB에 저장됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[220px]">
              <div className="rounded-2xl bg-white border border-[#eadfca] p-4">
                <p className="text-xs text-[#7b7062]">대기중</p>
                <p className="text-3xl font-black text-[#d9792b]">{pendingCount}</p>
              </div>
              <div className="rounded-2xl bg-white border border-[#eadfca] p-4">
                <p className="text-xs text-[#7b7062]">완료</p>
                <p className="text-3xl font-black">{completedCount}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="grid w-full lg:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onSubmit={addRow}
            className="rounded-[2rem] bg-white border border-[#eadfca] shadow-sm p-5 md:p-6 h-fit"
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#fff1df] flex items-center justify-center text-[#d9792b]">
                <Icon name="plus" size={21} />
              </div>
              <div>
                <h2 className="text-xl font-black">반품 접수 등록</h2>
                <p className="text-xs text-[#7b7062]">직원이 바로 입력하는 반품 접수 폼입니다.</p>
              </div>
            </div>

            <label className="block mb-4">
              <span className="text-sm font-bold">반품접수일자</span>
              <input
                type="date"
                value={form.receivedDate}
                onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold">상호명</span>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="예: 카페아울렛"
                className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
              />
            </label>

            <div className="mb-4">
              <div className="mb-4 rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <span className="text-sm font-bold">품목 빠른입력</span>
                    <p className="mt-1 text-xs text-[#7b7062]">예: 16온스페트컵 1박스, 종이컵 500개</p>
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkItemsText}
                    className="shrink-0 rounded-xl bg-[#26231d] px-3 py-2 text-xs font-black text-white hover:bg-black"
                  >
                    적용
                  </button>
                </div>
                <textarea
                  value={bulkItemsText}
                  onChange={(e) => setBulkItemsText(e.target.value)}
                  placeholder="16온스페트컵 1박스, 종이컵 1박스"
                  rows={2}
                  className="w-full rounded-2xl border border-[#dfd3bf] bg-white px-4 py-3 outline-none focus:border-[#d9792b] resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-bold">반품 품목 / 수량</span>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-xl border border-[#dfd3bf] px-3 py-2 text-xs font-black hover:border-[#d9792b]"
                >
                  + 품목 추가
                </button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-[#d9792b]">품목 {index + 1}</p>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-xs font-bold text-red-500 hover:underline"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <input
                      value={item.itemName}
                      onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                      placeholder="예: 16온스 PET 투명컵"
                      className="w-full rounded-2xl border border-[#dfd3bf] bg-white px-4 py-3 outline-none focus:border-[#d9792b]"
                    />
                    <div className="grid grid-cols-[1fr_100px] gap-2 mt-2">
                      <input
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="수량"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[#dfd3bf] bg-white px-4 py-3 outline-none focus:border-[#d9792b]"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                        className="w-full rounded-2xl border border-[#dfd3bf] bg-white px-3 py-3 outline-none focus:border-[#d9792b]"
                      >
                        <option value="개">개</option>
                        <option value="박스">박스</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block mb-4">
              <span className="text-sm font-bold">반품사유</span>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="예: 파손, 오배송, 수량 부족 등"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b] resize-none"
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold">반품접수자</span>
              <input
                value={form.receiver}
                onChange={(e) => setForm({ ...form, receiver: e.target.value })}
                placeholder="예: 김대리"
                className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
              />
            </label>

            <div className="mb-5">
              <span className="text-sm font-bold">반품사진 업로드</span>
              <label className="mt-2 flex min-h-[130px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed border-[#dfd3bf] bg-[#fffaf0] hover:border-[#d9792b] transition">
                {form.photoPreview ? (
                  <div className="w-full p-3">
                    <img src={form.photoPreview} alt="반품사진" className="mx-auto h-32 object-contain rounded-2xl" />
                    <p className="mt-2 text-center text-xs text-[#7b7062] truncate">{form.photoName}</p>
                  </div>
                ) : (
                  <div className="text-center text-[#7b7062]">
                    <Icon name="upload" size={24} className="mx-auto mb-2" />
                    <p className="text-sm">사진 선택하기</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
              </label>
            </div>

            <button
              disabled={saving}
              className="w-full rounded-2xl bg-[#d9792b] text-white font-black py-4 hover:bg-[#c86b20] transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "등록 중..." : "반품 접수 등록"}
            </button>
          </motion.form>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="min-w-0 rounded-[2rem] bg-white border border-[#eadfca] shadow-sm p-5 md:p-6"
          >
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black">반품 내역</h2>
                <p className="text-xs text-[#7b7062]">입고완료 처리하면 완료일자가 자동 저장됩니다.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={loadRows}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dfd3bf] px-4 py-3 text-sm font-black hover:border-[#d9792b]"
                >
                  <Icon name="refresh" size={16} /> 새로고침
                </button>

                <div className="relative">
                  <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7b7062]" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="상호명/물품명 검색"
                    className="w-full sm:w-64 rounded-2xl border border-[#dfd3bf] pl-11 pr-4 py-3 outline-none focus:border-[#d9792b]"
                  />
                </div>

                <div className="flex rounded-2xl bg-[#f7f3ea] p-1 border border-[#eadfca]">
                  <button
                    type="button"
                    onClick={() => setView("pending")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold ${view === "pending" ? "bg-white shadow-sm text-[#d9792b]" : "text-[#7b7062]"}`}
                  >
                    대기
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("completed")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold ${view === "completed" ? "bg-white shadow-sm text-[#d9792b]" : "text-[#7b7062]"}`}
                  >
                    완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("all")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold ${view === "all" ? "bg-white shadow-sm text-[#d9792b]" : "text-[#7b7062]"}`}
                  >
                    전체보기
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto rounded-3xl border border-[#eadfca]">
              <table className="w-full min-w-[1500px] table-fixed text-sm">
                <thead className="bg-[#fff6e8] text-[#6b6256]">
                  <tr>
                    <th className="w-[100px] whitespace-nowrap text-center p-4 align-middle">상태</th>
                    <th className="w-[150px] whitespace-nowrap text-center p-4 align-middle">
                      <button
                        type="button"
                        onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
                        className="mx-auto inline-flex items-center justify-center gap-1 whitespace-nowrap font-black hover:text-[#d9792b]"
                        title="반품접수일자 정렬"
                      >
                        반품접수일자 {sortDirection === "desc" ? "↓" : "↑"}
                      </button>
                    </th>
                    <th className="w-[220px] whitespace-nowrap text-center p-4 align-middle">상호명</th>
                    <th className="w-[360px] whitespace-nowrap text-center p-4 align-middle">물품명</th>
                    <th className="w-[110px] whitespace-nowrap text-center p-4 align-middle">수량</th>
                    <th className="w-[140px] whitespace-nowrap text-center p-4 align-middle">반품사유</th>
                    <th className="w-[120px] whitespace-nowrap text-center p-4 align-middle">접수자</th>
                    <th className="w-[100px] whitespace-nowrap text-center p-4 align-middle">사진</th>
                    <th className="w-[130px] whitespace-nowrap text-center p-4 align-middle">완료일자</th>
                    <th className="w-[270px] whitespace-nowrap text-center p-4 align-middle">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="p-10 text-center text-[#8b8174]">
                        불러오는 중...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-10 text-center text-[#8b8174]">
                        등록된 반품 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-[#eadfca] hover:bg-[#fffaf0]">
                        <td className="p-4 text-center align-middle whitespace-nowrap">
                          {row.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8ef] text-[#287d3c] px-3 py-1 text-xs font-black">
                              <Icon name="check" size={14} /> 완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1df] text-[#d9792b] px-3 py-1 text-xs font-black">
                              <Icon name="clock" size={14} /> 대기
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center align-middle whitespace-nowrap font-semibold">{row.receivedDate}</td>
                        <td className="p-4 text-center align-middle font-bold">
                          <button
                            type="button"
                            onClick={() => setPreviewText({ title: "상호명 전체보기", content: row.companyName })}
                            className="mx-auto block max-w-[190px] truncate rounded-lg px-2 py-1 hover:bg-[#fff1df] hover:text-[#d9792b]"
                            title="클릭해서 상호명 전체보기"
                          >
                            {row.companyName}
                          </button>
                        </td>
                        <td className="p-4 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setPreviewText({ title: "물품명 전체보기", content: row.itemName })}
                            className="mx-auto block max-w-[330px] truncate rounded-lg px-2 py-1 hover:bg-[#fff1df] hover:text-[#d9792b]"
                            title="클릭해서 물품명 전체보기"
                          >
                            {row.itemName}
                          </button>
                        </td>
                        <td className="p-4 text-center align-middle whitespace-nowrap font-semibold">{row.quantity ? `${row.quantity}${row.unit || ""}` : "-"}</td>
                        <td className="p-4 text-center align-middle whitespace-nowrap">
                          {row.reason ? (
                            <button
                              type="button"
                              onClick={() => setPreviewReason(row.reason)}
                              className="inline-flex min-w-[86px] items-center justify-center rounded-xl border border-[#dfd3bf] bg-white px-3 py-2 text-sm font-black text-[#26231d] hover:border-[#d9792b] hover:text-[#d9792b]"
                              title="클릭해서 반품사유 전체보기"
                            >
                              {truncateReason(row.reason)}
                            </button>
                          ) : (
                            <span className="text-[#aaa094]">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center align-middle whitespace-nowrap">{row.receiver || "-"}</td>
                        <td className="p-4 text-center align-middle whitespace-nowrap">
                          {row.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(row.photoUrl)}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#dfd3bf] px-3 py-2 font-bold hover:border-[#d9792b]"
                            >
                              <Icon name="image" size={15} /> 보기
                            </button>
                          ) : (
                            <span className="text-[#aaa094]">없음</span>
                          )}
                        </td>
                        <td className="p-4 text-center align-middle whitespace-nowrap font-semibold">{row.completedDate || "-"}</td>
                        <td className="p-4 text-center align-middle whitespace-nowrap">
                          <div className="flex justify-center gap-2">
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() => completeRow(row.id)}
                                className="rounded-xl bg-[#26231d] text-white px-3 py-2 text-xs font-black hover:bg-black"
                              >
                                입고완료
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => restoreRow(row.id)}
                                className="rounded-xl border border-[#dfd3bf] px-3 py-2 text-xs font-black hover:border-[#d9792b] inline-flex items-center gap-1"
                              >
                                <Icon name="rotate" size={13} /> 되돌림
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditRow(row)}
                              className="rounded-xl border border-[#dfd3bf] px-3 py-2 text-xs font-black hover:border-[#d9792b] hover:text-[#d9792b]"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow(row)}
                              className="rounded-xl border border-[#dfd3bf] px-3 py-2 text-xs font-black hover:border-red-400 hover:text-red-500"
                              aria-label="삭제"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>
        </div>
      </div>

      {editingRow && editForm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
          onClick={cancelEditRow}
        >
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <p className="text-sm font-semibold text-[#d9792b]">EDIT RETURN</p>
              <h3 className="text-2xl font-black">반품 내역 수정</h3>
            </div>

            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm font-bold">반품접수일자</span>
                <input
                  type="date"
                  value={editForm.receivedDate}
                  onChange={(e) => setEditForm({ ...editForm, receivedDate: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">상호명</span>
                <input
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">물품명</span>
                <input
                  value={editForm.itemName}
                  onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
                />
              </label>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <label className="block">
                  <span className="text-sm font-bold">수량</span>
                  <input
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold">단위</span>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-3 py-3 outline-none focus:border-[#d9792b]"
                  >
                    <option value="개">개</option>
                    <option value="박스">박스</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold">반품사유</span>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b] resize-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">접수자</span>
                <input
                  value={editForm.receiver}
                  onChange={(e) => setEditForm({ ...editForm, receiver: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelEditRow}
                className="rounded-2xl border border-[#dfd3bf] py-3 font-black hover:border-[#d9792b]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveEditRow}
                disabled={saving}
                className="rounded-2xl bg-[#d9792b] text-white py-3 font-black hover:bg-[#c86b20] disabled:opacity-60"
              >
                {saving ? "저장 중..." : "수정 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewText && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
          onClick={() => setPreviewText(null)}
        >
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <p className="text-sm font-semibold text-[#d9792b]">DETAIL VIEW</p>
              <h3 className="text-2xl font-black">{previewText.title}</h3>
            </div>
            <div className="min-h-[110px] rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5 text-lg font-semibold leading-relaxed whitespace-pre-wrap break-words">
              {previewText.content}
            </div>
            <button
              type="button"
              onClick={() => setPreviewText(null)}
              className="mt-4 w-full rounded-2xl bg-[#26231d] text-white font-black py-3"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {previewReason && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
          onClick={() => setPreviewReason(null)}
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <p className="text-sm font-semibold text-[#d9792b]">RETURN REASON</p>
              <h3 className="text-2xl font-black">반품사유 전체보기</h3>
            </div>
            <div className="min-h-[120px] rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5 text-lg font-semibold leading-relaxed whitespace-pre-wrap">
              {previewReason}
            </div>
            <button
              type="button"
              onClick={() => setPreviewReason(null)}
              className="mt-4 w-full rounded-2xl bg-[#26231d] text-white font-black py-3"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-white rounded-[2rem] p-4" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="반품 사진 확대" className="max-h-[80vh] w-full object-contain rounded-2xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="mt-3 w-full rounded-2xl bg-[#26231d] text-white font-black py-3"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
