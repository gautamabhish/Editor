import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import jsPDF from 'jspdf';

export const Board = () => {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const history = useRef<string[]>([]);
  const current = useRef<number>(-1);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#000000');
  const [selectedButton, setSelectedButton] = useState<string | null>(null);

  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    const initCanvas = () => {
      if (!canvasRef.current || !canvasWrapperRef.current) return;
      const wrapper = canvasWrapperRef.current;
      const width = Math.min(wrapper.clientWidth - 60, 1200);
      const height = Math.min(window.innerHeight - 180, 800);
      const oldCanvas = canvasRef.current;
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'certificate-canvas';
      oldCanvas.parentNode?.replaceChild(newCanvas, oldCanvas);
      canvasRef.current = newCanvas;
      const canvas = new fabric.Canvas(newCanvas, { width, height, backgroundColor: '#ffffff', selection: true, isDrawingMode: false });
      fabricCanvasRef.current = canvas;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = brushColor;
      canvas.freeDrawingBrush.width = brushSize;
      canvas.on('object:added', () => !canvas.isDrawingMode && saveState());
      canvas.on('object:modified', saveState);
      canvas.on('path:created', saveState);
      saveState(); setIsCanvasReady(true);
      const handleResize = () => {
        if (!canvasWrapperRef.current) return;
        const w = Math.min(canvasWrapperRef.current.clientWidth - 60, 1200);
        const h = Math.min(window.innerHeight - 180, 800);
        canvas.setDimensions({ width: w, height: h });
        canvas.renderAll();
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    };
    const timer = setTimeout(initCanvas, 100);
    return () => { clearTimeout(timer); fabricCanvasRef.current?.dispose(); };
  }, []);

  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c || !c.freeDrawingBrush) return;
    c.freeDrawingBrush.color = isEraserMode ? '#ffffff' : brushColor;
    c.freeDrawingBrush.width = brushSize;
    if (isEraserMode) {
      (c.freeDrawingBrush as any).globalCompositeOperation = 'destination-out';
    } else {
      (c.freeDrawingBrush as any).globalCompositeOperation = 'source-over';
    }
  }, [brushColor, brushSize, isEraserMode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && fabricCanvasRef.current) {
        const c = fabricCanvasRef.current;
        const active = c.getActiveObject();
        if (active) { c.remove(active); saveState(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const saveState = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    history.current = history.current.slice(0, current.current + 1);
    history.current.push(JSON.stringify(c.toJSON()));
    current.current++;
  };

  const undo = () => { const c = fabricCanvasRef.current; if (!c || current.current <= 0) return; current.current--; c.loadFromJSON(history.current[current.current], c.renderAll.bind(c)); setSelectedButton('undo'); };
  const redo = () => { const c = fabricCanvasRef.current; if (!c || current.current >= history.current.length - 1) return; current.current++; c.loadFromJSON(history.current[current.current], c.renderAll.bind(c)); setSelectedButton('redo'); };

  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    exitDrawingModes(c);
    const text = new fabric.IText('Editable Text', { left: c.width!/2, top: c.height!/2, fontSize:24, originX:'center', originY:'center' });
    c.add(text); c.setActiveObject(text); c.renderAll(); saveState(); setSelectedButton('text');
  };

  const addRect = () => { const c = fabricCanvasRef.current; if (!c) return; exitDrawingModes(c); const rect = new fabric.Rect({ left:50, top:50, width:100, height:60, fill:'#4caf50', selectable:true }); c.add(rect); c.setActiveObject(rect); c.renderAll(); saveState(); setSelectedButton('rect'); };
  const addCircle = () => { const c = fabricCanvasRef.current; if (!c) return; exitDrawingModes(c); const circle = new fabric.Circle({ left:100, top:100, radius:50, fill:'#ff5722', selectable:true }); c.add(circle); c.setActiveObject(circle); c.renderAll(); saveState(); setSelectedButton('circle'); };
  const addTriangle = () => { const c = fabricCanvasRef.current; if (!c) return; exitDrawingModes(c); const tri = new fabric.Triangle({ left:150, top:150, width:80, height:80, fill:'#3f51b5', selectable:true }); c.add(tri); c.setActiveObject(tri); c.renderAll(); saveState(); setSelectedButton('triangle'); };

  const toggleDrawingMode = () => { const c=fabricCanvasRef.current; if(!c) return; exitDrawingModes(c); const on=!c.isDrawingMode; c.freeDrawingBrush=new fabric.PencilBrush(c); c.isDrawingMode=on; setIsDrawingMode(on); setIsEraserMode(false); setSelectedButton(on?'draw':null); c.renderAll(); };
  const toggleEraser = () => { const c=fabricCanvasRef.current; if(!c) return; exitDrawingModes(c); const on = !isEraserMode; c.freeDrawingBrush=new fabric.PencilBrush(c); c.isDrawingMode=on; setIsDrawingMode(on); setIsEraserMode(on); setSelectedButton(on?'erase':null); c.renderAll(); };

  const exitDrawingModes = (c: fabric.Canvas) => { c.isDrawingMode = false; setIsDrawingMode(false); setIsEraserMode(false); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c=fabricCanvasRef.current; if(!c) return; exitDrawingModes(c);
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader(); reader.onload=ev=>fabric.Image.fromURL(ev.target!.result as string,img=>{
      const max=Math.min(c.width!,c.height!)*0.5;
      if(img.width!>img.height!&&img.width!>max) img.scaleToWidth(max);
      else if(img.height!>max) img.scaleToHeight(max);
      img.set({ left:c.width!/2, top:c.height!/2, originX:'center', originY:'center' });
      c.add(img); c.setActiveObject(img); c.renderAll(); saveState(); setSelectedButton('image');
    }); reader.readAsDataURL(file); e.target.value='';
  };

  const exportAsPNG = () => { const c=fabricCanvasRef.current; if(!c) return; exitDrawingModes(c); setSelectedButton('png'); const data=c.toDataURL({format:'png',multiplier:2}); const link=document.createElement('a'); link.href=data; link.download='certificate.png'; link.click(); };
  const exportAsPDF = () => { const c=fabricCanvasRef.current; if(!c) return; exitDrawingModes(c); setSelectedButton('pdf'); const data=c.toDataURL({format:'png',multiplier:2}); const orient=c.width!>c.height!?'landscape':'portrait'; const pdf=new jsPDF(orient,'mm','a4'); const w=orient==='landscape'?277:190; const h=w*(c.height!/c.width!); pdf.addImage(data,'PNG',10,10,w,h); pdf.save('certificate.pdf'); };
  const clearCanvas = () => { const c=fabricCanvasRef.current; if(!c) return; c.clear(); c.setBackgroundColor('#fff',c.renderAll.bind(c)); saveState(); setSelectedButton('clear'); };

  const changeBrushSize=(size:number)=>{ setBrushSize(size); if(fabricCanvasRef.current) fabricCanvasRef.current.freeDrawingBrush.width=size; };
  const changeBrushColor=(color:string)=>{ setBrushColor(color); if(fabricCanvasRef.current) fabricCanvasRef.current.freeDrawingBrush.color=color; };

  const base={ padding:'8px 12px',borderRadius:'4px',background:'#fff',border:'1px solid #d1d5db',cursor:'pointer',margin:'4px' };
  const active={ ...base,background:'#4f46e5',color:'#fff',borderColor:'#4338ca' };

  return (
    <>
      <div style={{padding:'12px 24px',background:'#e5e7eb',display:'flex',gap:'8px',flexWrap:'wrap',borderBottom:'1px solid #d1d5db',alignItems:'center',justifyContent:'center'}}>
        <button onClick={addText} style={selectedButton==='text'?active:base} disabled={!isCanvasReady}>📝 Add Text</button>
        <button onClick={addRect} style={selectedButton==='rect'?active:base} disabled={!isCanvasReady}>⬜ Add Rect</button>
        <button onClick={addCircle} style={selectedButton==='circle'?active:base} disabled={!isCanvasReady}>⚪ Add Circle</button>
        <button onClick={addTriangle} style={selectedButton==='triangle'?active:base} disabled={!isCanvasReady}>🔺 Add Triangle</button>
        <button onClick={toggleDrawingMode} style={selectedButton==='draw'?active:base} disabled={!isCanvasReady}>{isDrawingMode?'✓ Drawing':'✍️ Draw'}</button>
        <button onClick={toggleEraser} style={selectedButton==='erase'?active:base} disabled={!isCanvasReady}>🧹 Eraser</button>
        {isDrawingMode && !isEraserMode && (
          <>
            <label>Size:<input type="range" min="1" max="20" value={brushSize} onChange={e=>changeBrushSize(+e.target.value)} /></label>
            <label>Color:<input type="color" value={brushColor} onChange={e=>changeBrushColor(e.target.value)} /></label>
          </>
        )}
        <label htmlFor="imageUpload" style={selectedButton==='image'?active:base}>🖼️ Upload</label>
        <input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}} disabled={!isCanvasReady} />
        <button onClick={exportAsPNG} style={selectedButton==='png'?active:base} disabled={!isCanvasReady}>⬇️ PNG</button>
        <button onClick={exportAsPDF} style={selectedButton==='pdf'?active:base} disabled={!isCanvasReady}>📄 PDF</button>
        <button onClick={undo} style={selectedButton==='undo'?active:base} disabled={!isCanvasReady}>↩️ Undo</button>
        <button onClick={redo} style={selectedButton==='redo'?active:base} disabled={!isCanvasReady}>↪️ Redo</button>
        <button onClick={clearCanvas} style={selectedButton==='clear'?active:base} disabled={!isCanvasReady}>🗑️ Clear</button>
      </div>
      <div ref={canvasWrapperRef} style={{padding:'30px',display:'flex',justifyContent:'center',alignItems:'center',minHeight:'500px',background:'#f3f4f6'}}>
        {!isCanvasReady && <div style={{position:'absolute',color:'#666'}}>Initializing canvas...</div>}
        <canvas ref={canvasRef} id="certificate-canvas" style={{border:'1px solid #000',background:'#fff',boxShadow:'0 4px 8px rgba(0,0,0,0.15)',display:isCanvasReady?'block':'none'}} />
      </div>
      {isCanvasReady && <div style={{textAlign:'center',marginTop:'10px',fontSize:'14px',color:'#666'}}>{isEraserMode?'Eraser Mode: ON':isDrawingMode?'Drawing Mode: ON':'Selection Mode: ON'}</div>}
    </>
  );
};