// 만든 사람 시트
import { h } from '../core/ui.js';

const LINKS = [
  ['GitHub', 'https://github.com/mnunu123'],
  ['기술 블로그', 'https://blog-1vld.vercel.app'],
  ['과정 중심 포트폴리오', 'https://my-project-one-sigma-74.vercel.app'],
  ['메일 mnunu1234@naver.com', 'mailto:mnunu1234@naver.com'],
];

const WORKS = [
  ['01', 'DRAIN-X', '2026.09 ~ 10 · 1인 · 제2회 ZYXCAD AX 경진대회 설계 부문 출품. 제출 도면 S01~S06의 치수로 3D를 만들었습니다.'],
  ['02', '쓰리봇', '2025.09 ~ 2026.02 · 노바로보틱스 공동창업 · PM · 딥테크 예비창업패키지 우수기업. 시제품 사진과 펌웨어 기준으로 만들었습니다.'],
  ['03', '면접훈련 로봇', '2026.02 ~ 11 · 한이음 ICT 프로젝트 · 서보 얼굴 구동 · 음성 · AI 연동 · 통합. 하드웨어 구성 기록 기준으로 만들었습니다.'],
  ['04', 'AQUA-SWAP', '2026.10 · 1인 · 2026 3D 디자인 공모전(한국생산성본부) 출품. 작품설명서 치수와 Fusion 렌더 기준으로 만들었습니다.'],
];

export function renderAbout(el) {
  el.replaceChildren(
    h('p', { class: 'kick' }, 'DESIGNER'),
    h('h2', { id: 'about-title' }, '박세준'),
    h('p', {}, '경북대학교 전자공학부 4학년, 2027년 2월 졸업 예정입니다. 펌웨어와 전장에서 시작해 비전, ROS2, 관제 웹, AI 에이전트까지 한 시스템으로 묶는 일을 해 왔습니다. 이 전시관은 제가 설계하거나 만든 로봇을 직접 돌려 보고, 열어 보고, 작동 순서대로 움직여 볼 수 있게 만든 포트폴리오입니다.'),
    h('div', { class: 'about-grid' },
      h('div', {}, h('b', {}, '14건'), h('span', {}, '공모전 수상')),
      h('div', {}, h('b', {}, '대상 2'), h('span', {}, '최우수 5 · 우수 4')),
      h('div', {}, h('b', {}, '6,100만'), h('span', {}, '정부 R&D 과제 (원)')),
      h('div', {}, h('b', {}, '4점'), h('span', {}, '3D 전시 작품'))),
    h('h3', {}, 'WORKS'),
    h('ul', { class: 'about-list' }, ...WORKS.map(([no, t, d]) => h('li', {}, h('b', {}, `${no} ${t}`), h('span', {}, d)))),
    h('h3', {}, 'LINKS'),
    h('div', { class: 'about-links' }, ...LINKS.map(([t, u]) => h('a', { href: u, target: u.startsWith('http') ? '_blank' : null, rel: 'noopener' }, t))),
    h('h3', {}, 'HOW TO VIEW'),
    h('p', {}, '드래그로 돌리고 휠로 확대합니다. 아래 띠나 모델에서 부품을 누르면 부품 카드가 열리고, ‘분리’를 켜면 그 부품만 남습니다. ‘반단면’은 모델을 잘라 속을 보여 주고, 도표를 끌면 작동 시점이 바뀝니다. 키보드: 스페이스 재생/정지, ←/→ 단계 이동, H 패널 숨기기.'),
  );
}
