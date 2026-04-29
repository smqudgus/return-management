import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";

/**
 * 실제 회사 배포용 Supabase 연동 버전
 *
 * 필요한 환경변수, Vercel > Project > Settings > Environment Variables에 등록
 * VITE_SUPABASE_URL=본인 Supabase Project URL
 * VITE_SUPABASE_ANON_KEY=본인 Supabase anon public key
 *
 * 로컬에서 실행할 때는 프로젝트 최상단에 .env 파일 생성
 * VITE_SUPABASE_URL=https://xxxx.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJxxxx
 *
 * 중요: 환경변수를 추가/수정한 뒤에는 개발 서버 또는 Vercel 배포를 다시 시작해야 합니다.
 *
 * Supabase SQL Editor에서 먼저 실행할 SQL
 *
 * create table if not exists public.returns (
 *   id uuid primary key default gen_random_uuid(),
 *   received_date date not null default current_date,
 *   company_name text not null,
 *   item_name text not null,
 *   reason text,
 *   receiver text,
 *   photo_url text,
 *   photo_path text,
 *   status text not null default 'pending' check (status in ('pending', 'completed')),
 *   completed_date date,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table public.returns enable row level security;
 *
 * -- 간단 사내용: 링크 아는 직원은 입력/조회/수정/삭제 가능
 * -- 더 안전하게 하려면 Supabase Auth 로그인 정책으로 변경 필요
 * create policy "Allow public read returns"
 * on public.returns for select
 * using (true);
 *
 * create policy "Allow public insert returns"
 * on public.returns for insert
 * with check (true);
 *
 * create policy "Allow public update returns"
 * on public.returns for update
 * using (true)
 * with check (true);
 *
 * create policy "Allow public delete returns"
 * on public.returns for delete
 * using (true);
 *
 * -- 사진 저장소 만들기
 * -- Supabase > Storage > New bucket
 * -- bucket name: return-photos
 * -- Public bucket: ON
 *
 * -- Storage 정책, SQL Editor에서 실행
 * create policy "Allow public upload return photos"
 * on storage.objects for insert
 * with check (bucket_id = 'return-photos');
 *
 * create policy "Allow public read return photos"
 * on storage.objects for select
 * using (bucket_id = 'return-photos');
 *
 * create policy "Allow public update return photos"
 * on storage.objects for update
 * using (bucket_id = 'return-photos')
 * with check (bucket_id = 'return-photos');
 *
 * create policy "Allow public delete return photos"
 * on storage.objects for delete
 * using (bucket_id = 'return-photos');
 */

const PHOTO_BUCKET = "return-photos";

// 기본 연결값: Vercel 환경변수가 없을 때도 바로 연결되게 넣어둔 값입니다.
// 실제 운영에서는 Vercel > Settings > Environment Variables에 같은 값을 넣는 방식을 추천합니다.
const DEFAULT_SUPABASE_URL = "https://zseibbnawsmmuyiyatbq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZWliYm5hd3NtbXV5aXlhdGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDA1MjQsImV4cCI6MjA5MzAxNjUyNH0.N1dk--i8pLI1JNlYeNSCfEsWyunYvqL8SXH5nMkSZHo";

function getEnvValue(key) {
  const viteEnv = import.meta.env || {};
  const globalEnv = typeof globalThis !== "undefined" && globalThis.__APP_ENV__ ? globalThis.__APP_ENV__ : {};
  const fallbackEnv = {
    VITE_SUPABASE_URL: DEFAULT_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: DEFAULT_SUPABASE_ANON_KEY,
  };

  return viteEnv[key] || globalEnv[key] || fallbackEnv[key] || "";
}

function createSupabaseClient() {
  const url = getEnvValue("VITE_SUPABASE_URL").trim();
  const anonKey = getEnvValue("VITE_SUPABASE_ANON_KEY").trim();

  if (!url || !anonKey) {
    return { client: null, url, anonKey };
  }

  return {
    client: createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          apikey: anonKey,
        },
      },
    }),
    url,
    anonKey,
  };
}

const supabaseConfig = createSupabaseClient();
const supabase = supabaseConfig.client;

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeFilePath(file) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `returns/${today()}/${id}.${safeExtension}`;
}

function createEmptyForm() {
  return {
    receivedDate: today(),
    companyName: "",
    itemName: "",
    reason: "",
    receiver: "",
    photoFile: null,
    photoPreview: "",
    photoName: "",
  };
}

function dbRowToUi(row) {
  return {
    id: row.id,
    receivedDate: row.received_date,
    companyName: row.company_name,
    itemName: row.item_name,
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
    const text = `${row.companyName || ""} ${row.itemName || ""} ${row.reason || ""} ${row.receiver || ""}`.toLowerCase();
    const byKeyword = cleanKeyword ? text.includes(cleanKeyword) : true;
    return byView && byKeyword;
  });
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
    reason: null,
    receiver: null,
    photo_url: null,
    photo_path: null,
    status: "pending",
    completed_date: null,
    created_at: "2026-04-29T00:00:00Z",
  });

  const oldAppEnv = globalThis.__APP_ENV__;
  globalThis.__APP_ENV__ = { VITE_TEST_SAMPLE_KEY: "sample-value" };

  console.assert(today().length === 10, "today() should return YYYY-MM-DD format");
  console.assert(getFilteredRows(sampleRows, "pending", "").length === 1, "pending filter should return one row");
  console.assert(getFilteredRows(sampleRows, "completed", "").length === 1, "completed filter should return one row");
  console.assert(getFilteredRows(sampleRows, "all", "컵").length === 2, "keyword search should find matching rows");
  console.assert(getFilteredRows(sampleRows, "pending", "카페아울렛").length === 1, "keyword search should work with Korean text");
  console.assert(getFilteredRows(sampleRows, "pending", "없는검색어").length === 0, "unknown keyword should return empty results");
  console.assert(mapped.companyName === "A상사" && mapped.reason === "", "dbRowToUi should normalize database fields");
  console.assert(getEnvValue("VITE_TEST_SAMPLE_KEY") === "sample-value", "getEnvValue should safely read fallback global env");
  console.assert(getEnvValue("VITE_UNKNOWN_KEY") === "", "getEnvValue should return empty string for missing env");
  console.assert(getEnvValue("VITE_SUPABASE_URL").includes("supabase.co"), "getEnvValue should provide default Supabase URL");
  console.assert(getEnvValue("VITE_SUPABASE_ANON_KEY").startsWith("sb_publishable_"), "getEnvValue should provide default publishable key");

  globalThis.__APP_ENV__ = oldAppEnv;
}

if (typeof window !== "undefined") {
  runSelfTests();
}

export default function ReturnManagementApp() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("pending");
  const [keyword, setKeyword] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [debugMessage, setDebugMessage] = useState("");

  const isReady = Boolean(supabase);

  const loadRows = async () => {
    if (!supabase) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("returns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(`반품 내역을 불러오지 못했습니다: ${error.message}`);
        setLoading(false);
        return;
      }

      setRows((data || []).map(dbRowToUi));
    } catch (error) {
      setErrorMessage(`Supabase 연결 실패: ${error.message || "네트워크 요청이 차단되었습니다."}`);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setDebugMessage("연결 테스트 중...");
    setErrorMessage("");

    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      setDebugMessage("Supabase URL 또는 KEY가 비어 있습니다.");
      return;
    }

    try {
      const response = await fetch(`${supabaseConfig.url}/rest/v1/returns?select=id&limit=1`, {
        method: "GET",
        headers: {
          apikey: supabaseConfig.anonKey,
          Authorization: `Bearer ${supabaseConfig.anonKey}`,
        },
      });

      const text = await response.text();

      if (!response.ok) {
        setDebugMessage(`연결 실패: HTTP ${response.status} / ${text.slice(0, 300)}`);
        return;
      }

      setDebugMessage("연결 성공: Supabase returns 테이블을 읽을 수 있습니다.");
    } catch (error) {
      setDebugMessage(`연결 실패: ${error.message || "Failed to fetch"}. URL, API KEY, 브라우저 차단, 네트워크를 확인해야 합니다.`);
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
  };

  const addRow = async (e) => {
    e.preventDefault();
    if (!supabase) return;

    if (!form.companyName.trim() || !form.itemName.trim()) {
      alert("상호명과 물품명은 꼭 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const { photoUrl, photoPath, uploadWarning } = await uploadPhotoIfNeeded();

      const payload = {
        received_date: form.receivedDate,
        company_name: form.companyName.trim(),
        item_name: form.itemName.trim(),
        reason: form.reason.trim() || null,
        receiver: form.receiver.trim() || null,
        photo_url: photoUrl || null,
        photo_path: photoPath || null,
        status: "pending",
        completed_date: null,
      };

      const { data, error } = await supabase
        .from("returns")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw new Error(`반품 등록 실패: ${error.message}`);

      setRows((prev) => [dbRowToUi(data), ...prev]);
      resetForm();
      setView("pending");

      if (uploadWarning) {
        setErrorMessage(`${uploadWarning} 반품 내역은 사진 없이 등록되었습니다. Supabase Storage의 return-photos 버킷과 정책을 확인해주세요.`);
      }
    } catch (error) {
      setErrorMessage(`반품 등록 실패: ${error.message || "Failed to fetch"}. Supabase 연결 테스트 버튼을 눌러 원인을 확인해주세요.`);
    } finally {
      setSaving(false);
    }
  };

  const completeRow = async (id) => {
    if (!supabase) return;

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
    if (!supabase) return;

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
    if (!supabase) return;
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

  const filteredRows = useMemo(() => getFilteredRows(rows, view, keyword), [rows, view, keyword]);
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] text-[#26231d] p-4 md:p-8 flex items-center justify-center">
        <section className="max-w-2xl rounded-[2rem] bg-white border border-[#eadfca] p-6 md:p-8 shadow-sm">
          <p className="text-sm font-semibold text-[#d9792b] mb-2">환경변수 설정 필요</p>
          <h1 className="text-3xl font-black mb-3">Supabase 연결 정보가 없습니다</h1>
          <p className="text-[#6b6256] leading-7">
            로컬에서는 프로젝트 최상단 <code className="bg-[#f7f3ea] px-2 py-1 rounded-lg">.env</code> 파일에, Vercel에서는 Project Settings의 Environment Variables에 아래 값을 넣어주세요.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#26231d] text-white p-4 text-sm">
{`VITE_SUPABASE_URL=https://zseibbnawssmmuyiyatbq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...`}
          </pre>
          <p className="mt-4 text-sm text-[#7b7062] leading-6">
            값을 넣은 뒤에는 개발 서버를 다시 실행하거나 Vercel에서 다시 배포해야 적용됩니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#26231d] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-[2rem] bg-[#fffaf0] border border-[#e8ddc8] shadow-sm p-6 md:p-8"
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

        <div className="mb-5 rounded-2xl border border-[#eadfca] bg-white px-4 py-4 text-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-[#6b6256] leading-6">
              <p className="font-black text-[#26231d]">Supabase 연결 상태 확인</p>
              <p>URL: {supabaseConfig.url || "없음"}</p>
              <p>KEY: {supabaseConfig.anonKey ? `${supabaseConfig.anonKey.slice(0, 14)}...` : "없음"}</p>
              {debugMessage && <p className="mt-2 font-bold text-[#d9792b]">{debugMessage}</p>}
            </div>
            <button
              type="button"
              onClick={testConnection}
              className="rounded-2xl bg-[#26231d] text-white px-5 py-3 font-black hover:bg-black"
            >
              연결 테스트
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6">
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
              <span className="text-sm font-bold">반품받은 일자</span>
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

            <label className="block mb-4">
              <span className="text-sm font-bold">물품명</span>
              <input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="예: 16온스 PET 투명컵"
                className="mt-2 w-full rounded-2xl border border-[#dfd3bf] px-4 py-3 outline-none focus:border-[#d9792b]"
              />
            </label>

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
            className="rounded-[2rem] bg-white border border-[#eadfca] shadow-sm p-5 md:p-6"
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

            <div className="overflow-x-auto rounded-3xl border border-[#eadfca]">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#fff6e8] text-[#6b6256]">
                  <tr>
                    <th className="text-left p-4">상태</th>
                    <th className="text-left p-4">반품받은 일자</th>
                    <th className="text-left p-4">상호명</th>
                    <th className="text-left p-4">물품명</th>
                    <th className="text-left p-4">반품사유</th>
                    <th className="text-left p-4">접수자</th>
                    <th className="text-left p-4">사진</th>
                    <th className="text-left p-4">완료일자</th>
                    <th className="text-left p-4">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="p-10 text-center text-[#8b8174]">
                        불러오는 중...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-10 text-center text-[#8b8174]">
                        등록된 반품 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-[#eadfca] hover:bg-[#fffaf0]">
                        <td className="p-4">
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
                        <td className="p-4 font-semibold">{row.receivedDate}</td>
                        <td className="p-4 font-bold">{row.companyName}</td>
                        <td className="p-4">{row.itemName}</td>
                        <td className="p-4 max-w-[230px] whitespace-pre-wrap">{row.reason || "-"}</td>
                        <td className="p-4">{row.receiver || "-"}</td>
                        <td className="p-4">
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
                        <td className="p-4 font-semibold">{row.completedDate || "-"}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
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
