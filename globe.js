(() => {
  const canvas = document.querySelector('#globe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, dpr = 1, longitude = -.45, tilt = -.12, pointerX = 0, pointerY = 0, hovering = false, last = performance.now();

  // Geographic silhouettes keep the white particles confined to real continents.
  let continents=[
    [[-168,70],[-145,72],[-128,61],[-112,58],[-98,50],[-83,48],[-77,40],[-67,46],[-53,50],[-60,58],[-78,61],[-91,68],[-112,72],[-130,70],[-148,72]],
    [[-117,32],[-108,24],[-98,19],[-90,16],[-84,10],[-77,8],[-78,20],[-86,22],[-91,18],[-97,25],[-106,30]],
    [[-81,12],[-70,10],[-60,5],[-50,-1],[-42,-8],[-36,-15],[-40,-22],[-47,-30],[-52,-39],[-60,-51],[-68,-55],[-74,-43],[-77,-28],[-80,-12]],
    [[-11,36],[-9,44],[-5,50],[-10,58],[-5,60],[-12,67],[2,71],[20,70],[30,65],[39,59],[30,50],[26,47],[15,40],[6,43]],
    [[-17,35],[-5,37],[10,34],[20,32],[30,31],[35,22],[43,12],[51,10],[50,0],[42,-12],[30,-20],[20,-35],[12,-34],[5,-25],[-4,-15],[-14,-5],[-17,10]],
    [[30,70],[45,60],[60,55],[70,60],[80,50],[95,55],[105,52],[120,50],[130,48],[140,50],[150,58],[160,60],[165,45],[150,40],[140,30],[130,25],[120,20],[110,10],[100,8],[90,20],[80,20],[70,30],[60,25],[50,30],[40,40]],
    [[35,32],[48,30],[55,20],[60,22],[70,22],[75,10],[62,5],[52,12],[43,10]],
    [[112,-11],[130,-12],[145,-17],[154,-26],[151,-38],[140,-40],[130,-30],[115,-20]],
    [[-8,60],[-6,58],[-3,59],[-4,61]],[[-20,65],[-14,62],[-13,65]]
  ];
  const inPolygon=(lon,lat,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let [x1,y1]=poly[i],[x2,y2]=poly[j];while(x1-lon>180)x1-=360;while(x1-lon< -180)x1+=360;while(x2-lon>180)x2-=360;while(x2-lon< -180)x2+=360;if((y1>lat)!==(y2>lat)&&lon<(x2-x1)*(lat-y1)/(y2-y1)+x1)hit=!hit}return hit};
  const landIndex=new Map();
  const rebuildLandIndex=()=>{landIndex.clear();const cell=(x,y)=>`${Math.floor((x+180)/5)},${Math.floor((y+90)/5)}`;continents.forEach((poly,index)=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),minX=Math.max(-180,Math.min(...xs)),maxX=Math.min(180,Math.max(...xs)),minY=Math.max(-90,Math.min(...ys)),maxY=Math.min(90,Math.max(...ys));for(let y=minY;y<=maxY;y+=5)for(let x=minX;x<=maxX;x+=5){const key=cell(x,y);if(!landIndex.has(key))landIndex.set(key,[]);landIndex.get(key).push(index)}})};
  rebuildLandIndex();
  const particles=[];
  const mobileQuery=matchMedia('(max-width: 767px)');
  let particleCount=mobileQuery.matches?1000:50000;
  const goldenAngle=Math.PI*(3-Math.sqrt(5));
  const buildParticles=()=>{particles.length=0;for(let i=0;i<particleCount;i++){const y=1-2*(i+.5)/particleCount,r=Math.sqrt(1-y*y),theta=goldenAngle*i,x=Math.cos(theta)*r,z=Math.sin(theta)*r,lat=Math.asin(y)*180/Math.PI,lon=Math.atan2(x,z)*180/Math.PI;const candidates=landIndex.get(`${Math.floor((lon+180)/5)},${Math.floor((lat+90)/5)}`)||[];if(candidates.some(index=>inPolygon(lon,lat,continents[index])))particles.push({x,y,z,phase:(i*2.399)%(Math.PI*2),size:.5+((i*37)%13)/16})}};
  buildParticles();
  mobileQuery.addEventListener('change',()=>{particleCount=mobileQuery.matches?1000:50000;buildParticles()});
  // Natural Earth 1:50m land geometry gives much cleaner coastlines than hand-drawn polygons.
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson').then(r=>{if(!r.ok)throw Error('land data unavailable');return r.json()}).then(data=>{const rings=[];for(const feature of data.features||[]){const g=feature.geometry;if(!g)continue;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];for(const poly of polys)if(poly[0]?.length>3)rings.push(poly[0].map(([lon,lat])=>[lon,lat]))}if(rings.length){continents=rings;rebuildLandIndex();buildParticles()}}).catch(()=>{});
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); width = box.width; height = box.height;
    canvas.width = Math.round(width*dpr);canvas.height = Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  new ResizeObserver(resize).observe(canvas); resize();
  const rotatePoint=(point,time=0)=>{const yaw=longitude,pitch=tilt,wave=1+.026*Math.sin(point.phase+time*.0024),x=point.x*wave,y=point.y*wave,z=point.z*wave,xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);return{x:xx,y:y*Math.cos(pitch)-zz*Math.sin(pitch),z:y*Math.sin(pitch)+zz*Math.cos(pitch)}};
  const project=(lon,lat)=>{const p=lat*Math.PI/180,l=lon*Math.PI/180+longitude,x=Math.cos(p)*Math.sin(l),y=Math.sin(p),z=Math.cos(p)*Math.cos(l);return{x,y:y*Math.cos(tilt)-z*Math.sin(tilt),z:y*Math.sin(tilt)+z*Math.cos(tilt)}};
  const draw = now => {
    const dt=Math.min((now-last)/1000,.05);last=now;if(!reduced)longitude+=dt*.12;tilt=-.12+pointerY*.08;
    const cx=width/2,cy=height/2,R=Math.min(width,height)*.385;ctx.clearRect(0,0,width,height);
    const dots=[];
    for(const point of particles){let q=rotatePoint(point,now);if(q.z<=0)continue;let x=cx+R*q.x,y=cy-R*q.y;const distance=Math.hypot(x-pointerX,y-pointerY),influence=hovering?Math.max(0,1-distance/115):0;if(influence){const wobble=Math.sin(now*.018+point.phase*2)*influence*6.5;x+=wobble;y+=Math.cos(now*.016+point.phase)*influence*6.5;q={...q,x:(x-cx)/R,y:-(y-cy)/R}}const depth=.3+.7*q.z;dots.push({x,y,z:q.z,r:point.size*(.38+.8*depth)*(R/155),depth,latitude:q.y,influence})}
    dots.sort((a,b)=>a.z-b.z);
    for(const d of dots){ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${.48+.52*d.depth})`;ctx.shadowColor='rgba(255,255,255,.8)';ctx.shadowBlur=d.depth>.76?2.4:0;ctx.fill()}
    ctx.shadowBlur=0;
    // A perspective orbit sweeps around the sphere, with a bright moving point.
    ctx.beginPath();let start=true;for(let i=0;i<=150;i++){const t=i/150*Math.PI*2,q=project(-180+i*2.4,14+29*Math.sin(t));if(q.z>.02){const x=cx+R*1.035*q.x,y=cy-R*1.035*q.y;if(start){ctx.moveTo(x,y);start=false}else ctx.lineTo(x,y)}else start=true}ctx.strokeStyle='rgba(241,43,40,.58)';ctx.lineWidth=1.3;ctx.setLineDash([3,8]);ctx.lineDashOffset=-now*.012;ctx.stroke();ctx.setLineDash([]);
    requestAnimationFrame(draw);
  };
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),nx=e.clientX-r.left,ny=e.clientY-r.top;pointerX=nx;pointerY=(ny-r.height/2)/(r.height/2)});
  canvas.addEventListener('pointerenter',e=>{const r=canvas.getBoundingClientRect();pointerX=e.clientX-r.left;hovering=true});
  canvas.addEventListener('pointerleave',()=>{pointerY=0;hovering=false});requestAnimationFrame(draw);
})();
