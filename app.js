const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req, res) => res.type('html').send(html));

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>新年烟花</title>

<style>
html,body{
	margin:0px;
	width:100%;
	height:100%;
	overflow:hidden;
	background:#000;
}
</style>

</head>
<body>
<canvas id="canvas" style="position:absolute;width:100%;height:100%;z-index:8888"></canvas>
<canvas style="position:absolute;width:100%;height:100%;z-index:9999" class="canvas" ></canvas>
<div class="overlay">
  <div class="tabs">
    <div class="tabs-labels"><span class="tabs-label">Commands</span><span class="tabs-label">Info</span><span class="tabs-label">Share</span></div>

    <div class="tabs-panels">
      <ul class="tabs-panel commands">
      </ul>
    </div>
  </div>
</div>
<script>
function initVars(){

	pi=Math.PI;
	ctx=canvas.getContext("2d");
	canvas.width=canvas.clientWidth;
	canvas.height=canvas.clientHeight;
	cx=canvas.width/2;
	cy=canvas.height/2;
	playerZ=-25;
	playerX=playerY=playerVX=playerVY=playerVZ=pitch=yaw=pitchV=yawV=0;
	scale=600;
	seedTimer=0;seedInterval=5,seedLife=100;gravity=.02;
	seeds=new Array();
	sparkPics=new Array();
	s="https://cantelope.org/NYE/";
	for(i=1;i<=10;++i){
		sparkPic=new Image();
		sparkPic.src=s+"spark"+i+".png";
		sparkPics.push(sparkPic);
	}
	sparks=new Array();
	pow1=new Audio(s+"pow1.ogg");
	pow2=new Audio(s+"pow2.ogg");
	pow3=new Audio(s+"pow3.ogg");
	pow4=new Audio(s+"pow4.ogg");
	frames = 0;
}

function rasterizePoint(x,y,z){

	var p,d;
	x-=playerX;
	y-=playerY;
	z-=playerZ;
	p=Math.atan2(x,z);
	d=Math.sqrt(x*x+z*z);
	x=Math.sin(p-yaw)*d;
	z=Math.cos(p-yaw)*d;
	p=Math.atan2(y,z);
	d=Math.sqrt(y*y+z*z);
	y=Math.sin(p-pitch)*d;
	z=Math.cos(p-pitch)*d;
	var rx1=-1000,ry1=1,rx2=1000,ry2=1,rx3=0,ry3=0,rx4=x,ry4=z,uc=(ry4-ry3)*(rx2-rx1)-(rx4-rx3)*(ry2-ry1);
	if(!uc) return {x:0,y:0,d:-1};
	var ua=((rx4-rx3)*(ry1-ry3)-(ry4-ry3)*(rx1-rx3))/uc;
	var ub=((rx2-rx1)*(ry1-ry3)-(ry2-ry1)*(rx1-rx3))/uc;
	if(!z)z=.000000001;
	if(ua>0&&ua<1&&ub>0&&ub<1){
		return {
			x:cx+(rx1+ua*(rx2-rx1))*scale,
			y:cy+y/z*scale,
			d:Math.sqrt(x*x+y*y+z*z)
		};
	}else{
		return {
			x:cx+(rx1+ua*(rx2-rx1))*scale,
			y:cy+y/z*scale,
			d:-1
		};
	}
}

function spawnSeed(){

	seed=new Object();
	seed.x=-50+Math.random()*100;
	seed.y=25;
	seed.z=-50+Math.random()*100;
	seed.vx=.1-Math.random()*.2;
	seed.vy=-1.5;//*(1+Math.random()/2);
	seed.vz=.1-Math.random()*.2;
	seed.born=frames;
	seeds.push(seed);
}

function splode(x,y,z){

	t=5+parseInt(Math.random()*150);
	sparkV=1+Math.random()*2.5;
	type=parseInt(Math.random()*3);
	switch(type){
		case 0:
			pic1=parseInt(Math.random()*10);
			break;
		case 1:
			pic1=parseInt(Math.random()*10);
			do{ pic2=parseInt(Math.random()*10); }while(pic2==pic1);
			break;
		case 2:
			pic1=parseInt(Math.random()*10);
			do{ pic2=parseInt(Math.random()*10); }while(pic2==pic1);
			do{ pic3=parseInt(Math.random()*10); }while(pic3==pic1 || pic3==pic2);
			break;
	}
	for(m=1;m<t;++m){
		spark=new Object();
		spark.x=x; spark.y=y; spark.z=z;
		p1=pi*2*Math.random();
		p2=pi*Math.random();
		v=sparkV*(1+Math.random()/6)
		spark.vx=Math.sin(p1)*Math.sin(p2)*v;
		spark.vz=Math.cos(p1)*Math.sin(p2)*v;
		spark.vy=Math.cos(p2)*v;
		switch(type){
			case 0: spark.img=sparkPics[pic1]; break;
			case 1:
				spark.img=sparkPics[parseInt(Math.random()*2)?pic1:pic2];
				break;
			case 2:
				switch(parseInt(Math.random()*3)){
					case 0: spark.img=sparkPics[pic1]; break;
					case 1: spark.img=sparkPics[pic2]; break;
					case 2: spark.img=sparkPics[pic3]; break;
				}
				break;
		}
		spark.radius=25+Math.random()*50;
		spark.alpha=1;
		spark.trail=new Array();
		sparks.push(spark);
	}
	switch(parseInt(Math.random()*4)){
		case 0:	pow=new Audio(s+"pow1.ogg"); break;
		case 1:	pow=new Audio(s+"pow2.ogg"); break;
		case 2:	pow=new Audio(s+"pow3.ogg"); break;
		case 3:	pow=new Audio(s+"pow4.ogg"); break;
	}
	d=Math.sqrt((x-playerX)*(x-playerX)+(y-playerY)*(y-playerY)+(z-playerZ)*(z-playerZ));
	pow.volume=1.5/(1+d/10);
	pow.play();
}

function doLogic(){

	if(seedTimer<frames){
		seedTimer=frames+seedInterval*Math.random()*10;
		spawnSeed();
	}
	for(i=0;i<seeds.length;++i){
		seeds[i].vy+=gravity;
		seeds[i].x+=seeds[i].vx;
		seeds[i].y+=seeds[i].vy;
		seeds[i].z+=seeds[i].vz;
		if(frames-seeds[i].born>seedLife){
			splode(seeds[i].x,seeds[i].y,seeds[i].z);
			seeds.splice(i,1);
		}
	}
	for(i=0;i<sparks.length;++i){
		if(sparks[i].alpha>0 && sparks[i].radius>5){
			sparks[i].alpha-=.01;
			sparks[i].radius/=1.02;
			sparks[i].vy+=gravity;
			point=new Object();
			point.x=sparks[i].x;
			point.y=sparks[i].y;
			point.z=sparks[i].z;
			if(sparks[i].trail.length){
				x=sparks[i].trail[sparks[i].trail.length-1].x;
				y=sparks[i].trail[sparks[i].trail.length-1].y;
				z=sparks[i].trail[sparks[i].trail.length-1].z;
				d=((point.x-x)*(point.x-x)+(point.y-y)*(point.y-y)+(point.z-z)*(point.z-z));
				if(d>9){
					sparks[i].trail.push(point);
				}
			}else{
				sparks[i].trail.push(point);
			}
			if(sparks[i].trail.length>5)sparks[i].trail.splice(0,1);
			sparks[i].x+=sparks[i].vx;
			sparks[i].y+=sparks[i].vy;
			sparks[i].z+=sparks[i].vz;
			sparks[i].vx/=1.075;
			sparks[i].vy/=1.075;
			sparks[i].vz/=1.075;
		}else{
			sparks.splice(i,1);
		}
	}
	p=Math.atan2(playerX,playerZ);
	d=Math.sqrt(playerX*playerX+playerZ*playerZ);
	d+=Math.sin(frames/80)/1.25;
	t=Math.sin(frames/200)/40;
	playerX=Math.sin(p+t)*d;
	playerZ=Math.cos(p+t)*d;
	yaw=pi+p+t;
}

function rgb(col){

	var r = parseInt((.5+Math.sin(col)*.5)*16);
	var g = parseInt((.5+Math.cos(col)*.5)*16);
	var b = parseInt((.5-Math.sin(col)*.5)*16);
	return "#"+r.toString(16)+g.toString(16)+b.toString(16);
}

function draw(){

	ctx.clearRect(0,0,cx*2,cy*2);

	ctx.fillStyle="#ff8";
	for(i=-100;i<100;i+=3){
		for(j=-100;j<100;j+=4){
			x=i;z=j;y=25;
			point=rasterizePoint(x,y,z);
			if(point.d!=-1){
				size=250/(1+point.d);
				d = Math.sqrt(x * x + z * z);
				a = 0.75 - Math.pow(d / 100, 6) * 0.75;
				if(a>0){
					ctx.globalAlpha = a;
					ctx.fillRect(point.x-size/2,point.y-size/2,size,size);
				}
			}
		}
	}
	ctx.globalAlpha=1;
	for(i=0;i<seeds.length;++i){
		point=rasterizePoint(seeds[i].x,seeds[i].y,seeds[i].z);
		if(point.d!=-1){
			size=200/(1+point.d);
			ctx.fillRect(point.x-size/2,point.y-size/2,size,size);
		}
	}
	point1=new Object();
	for(i=0;i<sparks.length;++i){
		point=rasterizePoint(sparks[i].x,sparks[i].y,sparks[i].z);
		if(point.d!=-1){
			size=sparks[i].radius*200/(1+point.d);
			if(sparks[i].alpha<0)sparks[i].alpha=0;
			if(sparks[i].trail.length){
				point1.x=point.x;
				point1.y=point.y;
				switch(sparks[i].img){
					case sparkPics[0]:ctx.strokeStyle="#f84";break;
					case sparkPics[1]:ctx.strokeStyle="#84f";break;
					case sparkPics[2]:ctx.strokeStyle="#8ff";break;
					case sparkPics[3]:ctx.strokeStyle="#fff";break;
					case sparkPics[4]:ctx.strokeStyle="#4f8";break;
					case sparkPics[5]:ctx.strokeStyle="#f44";break;
					case sparkPics[6]:ctx.strokeStyle="#f84";break;
					case sparkPics[7]:ctx.strokeStyle="#84f";break;
					case sparkPics[8]:ctx.strokeStyle="#fff";break;
					case sparkPics[9]:ctx.strokeStyle="#44f";break;
				}
				for(j=sparks[i].trail.length-1;j>=0;--j){
					point2=rasterizePoint(sparks[i].trail[j].x,sparks[i].trail[j].y,sparks[i].trail[j].z);
					if(point2.d!=-1){
						ctx.globalAlpha=j/sparks[i].trail.length*sparks[i].alpha/2;
						ctx.beginPath();
						ctx.moveTo(point1.x,point1.y);
						ctx.lineWidth=1+sparks[i].radius*10/(sparks[i].trail.length-j)/(1+point2.d);
						ctx.lineTo(point2.x,point2.y);
						ctx.stroke();
						point1.x=point2.x;
						point1.y=point2.y;
					}
				}
			}
			ctx.globalAlpha=sparks[i].alpha;
			ctx.drawImage(sparks[i].img,point.x-size/2,point.y-size/2,size,size);
		}
	}
}

function frame(){

	if(frames>100000){
		seedTimer=0;
		frames=0;
	}
	frames++;
	draw();
	doLogic();
	requestAnimationFrame(frame);
}

window.addEventListener("resize",()=>{
	canvas.width=canvas.clientWidth;
	canvas.height=canvas.clientHeight;
	cx=canvas.width/2;
	cy=canvas.height/2;
});

initVars();
frame();
</script>
<script>
	
	
/*

  Shape Shifter
  =============
  A canvas experiment by Kenneth Cachia
  http://www.kennethcachia.com

  Updated code
  ------------
  https://github.com/kennethcachia/Shape-Shifter

*/


var S = {
  init: function () {
    var action = window.location.href,
        i = action.indexOf('?a=');

    S.Drawing.init('.canvas');
    document.body.classList.add('body--ready');

    if (i !== -1) {
      S.UI.simulate(decodeURI(action).substring(i + 3));
    } else {
      S.UI.simulate('|#countdown 3||新|年|快|乐|#rectangle|');
    }

    S.Drawing.loop(function () {
      S.Shape.render();
    });
  }
};


S.Drawing = (function () {
  var canvas,
      context,
      renderFn
      requestFrame = window.requestAnimationFrame       ||
                     window.webkitRequestAnimationFrame ||
                     window.mozRequestAnimationFrame    ||
                     window.oRequestAnimationFrame      ||
                     window.msRequestAnimationFrame     ||
                     function(callback) {
                       window.setTimeout(callback, 1000 / 60);
                     };

  return {
    init: function (el) {
      canvas = document.querySelector(el);
      context = canvas.getContext('2d');
      this.adjustCanvas();

      window.addEventListener('resize', function (e) {
        S.Drawing.adjustCanvas();
      });
    },

    loop: function (fn) {
      renderFn = !renderFn ? fn : renderFn;
      this.clearFrame();
      renderFn();
      requestFrame.call(window, this.loop.bind(this));
    },

    adjustCanvas: function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    },

    clearFrame: function () {
      context.clearRect(0, 0, canvas.width, canvas.height);
    },

    getArea: function () {
      return { w: canvas.width, h: canvas.height };
    },

    drawCircle: function (p, c) {
      context.fillStyle = c.render();
      context.beginPath();
      context.arc(p.x, p.y, p.z, 0, 2 * Math.PI, true);
      context.closePath();
      context.fill();
    }
  }
}());


S.UI = (function () {
  var canvas = document.querySelector('.canvas'),
      interval,
      isTouch = false, //('ontouchstart' in window || navigator.msMaxTouchPoints),
      currentAction,
      resizeTimer,
      time,
      maxShapeSize = 30,
      firstAction = true,
      sequence = [],
      cmd = '#';

  function formatTime(date) {
    var h = date.getHours(),
        m = date.getMinutes(),
    m = m < 10 ? '0' + m : m;
    return h + ':' + m;
  }

  function getValue(value) {
    return value && value.split(' ')[1];
  }

  function getAction(value) {
    value = value && value.split(' ')[0];
    return value && value[0] === cmd && value.substring(1);
  }

  function timedAction(fn, delay, max, reverse) {
    clearInterval(interval);
    currentAction = reverse ? max : 1;
    fn(currentAction);

    if (!max || (!reverse && currentAction < max) || (reverse && currentAction > 0)) {
      interval = setInterval(function () {
        currentAction = reverse ? currentAction - 1 : currentAction + 1;
        fn(currentAction);

        if ((!reverse && max && currentAction === max) || (reverse && currentAction === 0)) {
          clearInterval(interval);
        }
      }, delay);
    }
  }

  function reset(destroy) {
    clearInterval(interval);
    sequence = [];
    time = null;
    destroy && S.Shape.switchShape(S.ShapeBuilder.letter(''));
  }

  function performAction(value) {
    var action,
        value,
        current;

    // overlay.classList.remove('overlay--visible');
    sequence = typeof(value) === 'object' ? value : sequence.concat(value.split('|'));
    // input.value = '';
    // checkInputWidth();

    timedAction(function (index) {
      current = sequence.shift();
      action = getAction(current);
      value = getValue(current);

      switch (action) {
        case 'countdown':
          value = parseInt(value) || 10;
          value = value > 0 ? value : 10;

          timedAction(function (index) {
            if (index === 0) {
              if (sequence.length === 0) {
                S.Shape.switchShape(S.ShapeBuilder.letter(''));
              } else {
                performAction(sequence);
              }
            } else {
              S.Shape.switchShape(S.ShapeBuilder.letter(index), true);
            }
          }, 1000, value, true);
          break;

        case 'rectangle':
          value = value && value.split('x');
          value = (value && value.length === 2) ? value : [maxShapeSize, maxShapeSize / 2];

          S.Shape.switchShape(S.ShapeBuilder.rectangle(Math.min(maxShapeSize, parseInt(value[0])), Math.min(maxShapeSize, parseInt(value[1]))));
          break;

        case 'circle':
          value = parseInt(value) || maxShapeSize;
          value = Math.min(value, maxShapeSize);
          S.Shape.switchShape(S.ShapeBuilder.circle(value));
          break;

        case 'time':
          var t = formatTime(new Date());

          if (sequence.length > 0) {
            S.Shape.switchShape(S.ShapeBuilder.letter(t));
          } else {
            timedAction(function () {
              t = formatTime(new Date());
              if (t !== time) {
                time = t;
                S.Shape.switchShape(S.ShapeBuilder.letter(time));
              }
            }, 1000);
          }
          break;

        default:
          S.Shape.switchShape(S.ShapeBuilder.letter(current[0] === cmd ? 'What?' : current));
      }
    }, 2000, sequence.length);
  }

  function checkInputWidth(e) {
    if (input.value.length > 18) {
      ui.classList.add('ui--wide');
    } else {
      ui.classList.remove('ui--wide');
    }

    if (firstAction && input.value.length > 0) {
      ui.classList.add('ui--enter');
    } else {
      ui.classList.remove('ui--enter');
    }
  }

  function bindEvents() {
    document.body.addEventListener('keydown', function (e) {
      input.focus();

      if (e.keyCode === 13) {
        firstAction = false;
        reset();
        performAction(input.value);
      }
    });

    canvas.addEventListener('click', function (e) {
      overlay.classList.remove('overlay--visible');
    });
  }

  function init() {
    bindEvents();
    // input.focus();
    isTouch && document.body.classList.add('touch');
  }

  // Init
  init();

  return {
    simulate: function (action) {
      performAction(action);
    }
  }
}());


S.UI.Tabs = (function () {
  var tabs = document.querySelector('.tabs'),
      labels = document.querySelector('.tabs-labels'),
      triggers = document.querySelectorAll('.tabs-label'),
      panels = document.querySelectorAll('.tabs-panel');

  function activate(i) {
    triggers[i].classList.add('tabs-label--active');
    panels[i].classList.add('tabs-panel--active');
  }

  function bindEvents() {
    labels.addEventListener('click', function (e) {
      var el = e.target,
          index;

      if (el.classList.contains('tabs-label')) {
        for (var t = 0; t < triggers.length; t++) {
          triggers[t].classList.remove('tabs-label--active');
          panels[t].classList.remove('tabs-panel--active');

          if (el === triggers[t]) {
            index = t;
          }
        }

        activate(index);
      }
    });
  }

  function init() {
    activate(0);
    bindEvents();
  }

  // Init
  init();
}());


S.Point = function (args) {
  this.x = args.x;
  this.y = args.y;
  this.z = args.z;
  this.a = args.a;
  this.h = args.h;
};


S.Color = function (r, g, b, a) {
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
};

S.Color.prototype = {
  render: function () {
    return 'rgba(' + this.r + ',' +  + this.g + ',' + this.b + ',' + this.a + ')';
  }
};


S.Dot = function (x, y) {
  this.p = new S.Point({
    x: x,
    y: y,
    z: 5,
    a: 1,
    h: 0
  });

  this.e = 0.07;
  this.s = true;

  this.c = new S.Color(255, 255, 255, this.p.a);

  this.t = this.clone();
  this.q = [];
};

S.Dot.prototype = {
  clone: function () {
    return new S.Point({
      x: this.x,
      y: this.y,
      z: this.z,
      a: this.a,
      h: this.h
    });
  },

  _draw: function () {
    this.c.a = this.p.a;
    S.Drawing.drawCircle(this.p, this.c);
  },

  _moveTowards: function (n) {
    var details = this.distanceTo(n, true),
        dx = details[0],
        dy = details[1],
        d = details[2],
        e = this.e * d;

    if (this.p.h === -1) {
      this.p.x = n.x;
      this.p.y = n.y;
      return true;
    }

    if (d > 1) {
      this.p.x -= ((dx / d) * e);
      this.p.y -= ((dy / d) * e);
    } else {
      if (this.p.h > 0) {
        this.p.h--;
      } else {
        return true;
      }
    }

    return false;
  },

  _update: function () {
    if (this._moveTowards(this.t)) {
      var p = this.q.shift();

      if (p) {
        this.t.x = p.x || this.p.x;
        this.t.y = p.y || this.p.y;
        this.t.z = p.z || this.p.z;
        this.t.a = p.a || this.p.a;
        this.p.h = p.h || 0;
      } else {
        if (this.s) {
          this.p.x -= Math.sin(Math.random() * 3.142);
          this.p.y -= Math.sin(Math.random() * 3.142);
        } else {
          this.move(new S.Point({
            x: this.p.x + (Math.random() * 50) - 25,
            y: this.p.y + (Math.random() * 50) - 25,
          }));
        }
      }
    }

    d = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - (d * 0.05));
    d = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - (d * 0.05));
  },

  distanceTo: function (n, details) {
    var dx = this.p.x - n.x,
        dy = this.p.y - n.y,
        d = Math.sqrt(dx * dx + dy * dy);

    return details ? [dx, dy, d] : d;
  },

  move: function (p, avoidStatic) {
    if (!avoidStatic || (avoidStatic && this.distanceTo(p) > 1)) {
      this.q.push(p);
    }
  },

  render: function () {
    this._update();
    this._draw();
  }
}


S.ShapeBuilder = (function () {
  var gap = 13,
      shapeCanvas = document.createElement('canvas'),
      shapeContext = shapeCanvas.getContext('2d'),
      fontSize = 500,
      fontFamily = 'Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';

  function fit() {
    shapeCanvas.width = Math.floor(window.innerWidth / gap) * gap;
    shapeCanvas.height = Math.floor(window.innerHeight / gap) * gap;
    shapeContext.fillStyle = 'red';
    shapeContext.textBaseline = 'middle';
    shapeContext.textAlign = 'center';
  }

  function processCanvas() {
    var pixels = shapeContext.getImageData(0, 0, shapeCanvas.width, shapeCanvas.height).data;
        dots = [],
        pixels,
        x = 0,
        y = 0,
        fx = shapeCanvas.width,
        fy = shapeCanvas.height,
        w = 0,
        h = 0;

    for (var p = 0; p < pixels.length; p += (4 * gap)) {
      if (pixels[p + 3] > 0) {
        dots.push(new S.Point({
          x: x,
          y: y
        }));

        w = x > w ? x : w;
        h = y > h ? y : h;
        fx = x < fx ? x : fx;
        fy = y < fy ? y : fy;
      }

      x += gap;

      if (x >= shapeCanvas.width) {
        x = 0;
        y += gap;
        p += gap * 4 * shapeCanvas.width;
      }
    }

    return { dots: dots, w: w + fx, h: h + fy };
  }

  function setFontSize(s) {
    shapeContext.font = 'bold ' + s + 'px ' + fontFamily;
  }

  function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function init() {
    fit();
    window.addEventListener('resize', fit);
  }

  // Init
  init();

  return {
    imageFile: function (url, callback) {
      var image = new Image(),
          a = S.Drawing.getArea();

      image.onload = function () {
        shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
        shapeContext.drawImage(this, 0, 0, a.h * 0.6, a.h * 0.6);
        callback(processCanvas());
      };

      image.onerror = function () {
        callback(S.ShapeBuilder.letter('What?'));
      }

      image.src = url;
    },

    circle: function (d) {
      var r = Math.max(0, d) / 2;
      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.beginPath();
      shapeContext.arc(r * gap, r * gap, r * gap, 0, 2 * Math.PI, false);
      shapeContext.fill();
      shapeContext.closePath();

      return processCanvas();
    },

    letter: function (l) {
      var s = 0;

      setFontSize(fontSize);
      s = Math.min(fontSize,
                  (shapeCanvas.width / shapeContext.measureText(l).width) * 0.8 * fontSize,
                  (shapeCanvas.height / fontSize) * (isNumber(l) ? 1 : 0.45) * fontSize);
      setFontSize(s);

      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.fillText(l, shapeCanvas.width / 2, shapeCanvas.height / 2);

      return processCanvas();
    },

    rectangle: function (w, h) {
      var dots = [],
          width = gap * w,
          height = gap * h;

      for (var y = 0; y < height; y += gap) {
        for (var x = 0; x < width; x += gap) {
          dots.push(new S.Point({
            x: x,
            y: y,
          }));
        }
      }

      return { dots: dots, w: width, h: height };
    }
  };
}());


S.Shape = (function () {
  var dots = [],
      width = 0,
      height = 0,
      cx = 0,
      cy = 0;

  function compensate() {
    var a = S.Drawing.getArea();

    cx = a.w / 2 - width / 2;
    cy = a.h / 2 - height / 2;
  }

  return {
    shuffleIdle: function () {
      var a = S.Drawing.getArea();

      for (var d = 0; d < dots.length; d++) {
        if (!dots[d].s) {
          dots[d].move({
            x: Math.random() * a.w,
            y: Math.random() * a.h
          });
        }
      }
    },

    switchShape: function (n, fast) {
      var size,
          a = S.Drawing.getArea();

      width = n.w;
      height = n.h;

      compensate();

      if (n.dots.length > dots.length) {
        size = n.dots.length - dots.length;
        for (var d = 1; d <= size; d++) {
          dots.push(new S.Dot(a.w / 2, a.h / 2));
        }
      }

      var d = 0,
          i = 0;

      while (n.dots.length > 0) {
        i = Math.floor(Math.random() * n.dots.length);
        dots[d].e = fast ? 0.25 : (dots[d].s ? 0.14 : 0.11);

        if (dots[d].s) {
          dots[d].move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 18
          }));
        } else {
          dots[d].move(new S.Point({
            z: Math.random() * 5 + 5,
            h: fast ? 18 : 30
          }));
        }

        dots[d].s = true;
        dots[d].move(new S.Point({
          x: n.dots[i].x + cx,
          y: n.dots[i].y + cy,
          a: 1,
          z: 5,
          h: 0
        }));

        n.dots = n.dots.slice(0, i).concat(n.dots.slice(i + 1));
        d++;
      }

      for (var i = d; i < dots.length; i++) {
        if (dots[i].s) {
          dots[i].move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 20
          }));

          dots[i].s = false;
          dots[i].e = 0.04;
          dots[i].move(new S.Point({
            x: Math.random() * a.w,
            y: Math.random() * a.h,
            a: 0.3, //.4
            z: Math.random() * 4,
            h: 0
          }));
        }
      }
    },

    render: function () {
      for (var d = 0; d < dots.length; d++) {
        dots[d].render();
      }
    }
  }
}());


S.init();

</script>

</body>
</html>



`
