import { translate } from './language-text';
function localizeChild(value: unknown): unknown {
  if (typeof value === 'string') return translate(value);
  if (Array.isArray(value)) return value.map(localizeChild);
  return value;
}
export function localizeProps(props: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props) return props;
  const next = { ...props };
  if ('children' in next) next.children=localizeChild(next.children);
  for (const key of ['title','alt','aria-label','placeholder','label','description']) {
    if (typeof next[key] === 'string') next[key] = translate(next[key] as string);
  }
  return next;
}

function canvasFont(font: string, text: string): string {
  if (!/[\u3400-\u9fff]/.test(text)) return font;
  return font.replace(/(\d+(?:\.\d+)?(?:px|pt))\s+.+$/, '$1 "GameChineseSans", sans-serif');
}
const canvas = CanvasRenderingContext2D.prototype;
const paint = canvas.fillText;
const outline = canvas.strokeText;
const measure = canvas.measureText;
canvas.fillText = function (text: string, x: number, y: number, width?: number): void {
  const value=translate(String(text)), font=this.font;this.font=canvasFont(font,value);
  try { if (width===undefined) paint.call(this,value,x,y);else paint.call(this,value,x,y,width); } finally { this.font=font; }
};
canvas.strokeText = function (text: string, x: number, y: number, width?: number): void {
  const value=translate(String(text)), font=this.font;this.font=canvasFont(font,value);
  try { if (width===undefined) outline.call(this,value,x,y);else outline.call(this,value,x,y,width); } finally { this.font=font; }
};
canvas.measureText = function (text: string): TextMetrics {
  const value=translate(String(text)), font=this.font;this.font=canvasFont(font,value);
  try { return measure.call(this,value); } finally { this.font=font; }
};

function localizeNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent=node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(parent.tagName) || parent.closest('[contenteditable="true"]')) return;
    const value=node.nodeValue || '', next=translate(value); if (next!==value) node.nodeValue=next;
    return;
  }
  if (!(node instanceof Element)) return;
  for (const key of ['title','alt','aria-label','placeholder']) {
    const value=node.getAttribute(key);if(value){const next=translate(value);if(next!==value)node.setAttribute(key,next);}
  }
  for (const child of Array.from(node.childNodes)) localizeNode(child);
}
const mount=document.getElementById('root');
if (mount) {
  new MutationObserver(changes=>{
    for(const change of changes){
      if(change.type==='characterData'||change.type==='attributes')localizeNode(change.target);
      else for(const node of Array.from(change.addedNodes))localizeNode(node);
    }
  }).observe(mount,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','alt','aria-label','placeholder']});
}
export const languageReady: Promise<unknown> = Promise.all([
  document.fonts.load('500 16px "GameChineseSans"'),
  document.fonts.load('700 24px "GameChineseDisplay"'),
]);
