// 확장 빌드: node build.mjs [--watch]
// 결과물은 dist/ 하나. chrome://extensions 에서 이 폴더를 "압축해제된 확장 프로그램 로드"로 연다.
//  1) 사이드 패널(React) + background → ES 모듈
//  2) content script → import 없는 단일 파일(IIFE). 파일이 아직 없으면 건너뛴다 (입고 담당 작업).
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { build } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const watch = process.argv.includes('--watch') ? {} : null;
const mode = watch ? 'development' : 'production';
const alias = { '@': resolve(root, 'src') };

rmSync(resolve(root, 'dist'), { recursive: true, force: true });

await build({
  root,
  mode,
  configFile: false,
  plugins: [react()],
  resolve: { alias },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    watch,
    sourcemap: Boolean(watch),
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'sidepanel.html'),
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

const contentEntry = resolve(root, 'src/content/index.ts');
if (existsSync(contentEntry)) {
  await build({
    root,
    mode,
    configFile: false,
    publicDir: false,
    resolve: { alias },
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      watch,
      sourcemap: Boolean(watch),
      lib: { entry: contentEntry, formats: ['iife'], name: 'StarLaundryContent', fileName: () => 'content.js' },
    },
  });
} else {
  // manifest가 content.js를 가리키므로 빈 파일을 둔다. 입고 담당 코드가 들어오면 자동으로 대체된다.
  writeFileSync(resolve(root, 'dist/content.js'), '// content script 준비 중\n');
  console.warn('[build] src/content/index.ts 가 없어 빈 content.js 를 만들었습니다.');
}
