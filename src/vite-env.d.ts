/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_API_PROXY_TARGET?: string;
  readonly VITE_AIEOS360_SHOWCASE_TEACHER_URL?: string;
  readonly VITE_AIEOS360_SHOWCASE_STUDENT_URL?: string;
  readonly VITE_AIEOS360_SHOWCASE_PRINCIPAL_URL?: string;
  readonly VITE_AIEOS360_SHOWCASE_PARENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
