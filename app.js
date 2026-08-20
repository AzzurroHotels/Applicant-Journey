const views=[...document.querySelectorAll(".screen")];

const questions=[
  {
    category:"CLEANING QUALITY",
    text:"After cleaning a room, what are the final things you would check before marking it as ready for the next guest?"
  },
  {
    category:"TASKS & COMMUNICATION",
    text:"At Azzurro Hotels, you may receive and update your daily work through a task list and communicate with our remote reception team. Are you comfortable working this way, keeping tasks updated, and communicating with remote reception to make sure everything is taken care of?"
  },
  {
    category:"BUSY OPERATIONS",
    text:"It is a busy day and several rooms still need to be prepared before guests arrive. How would you manage your tasks to make sure rooms are cleaned properly and ready on time?"
  },
  {
    category:"MAINTENANCE & REPORTING",
    text:"While cleaning, you notice something isn't working properly, such as an air conditioner, bathroom light, or damaged fixture. What would you do?"
  },
  {
    category:"INTEGRITY",
    text:"While cleaning a room after checkout, you find cash or another valuable item that appears to have been left behind by a guest. What would you do?"
  }
];

let current=0;
let recording=false;
let stream=null;

function show(id){
  views.forEach(v=>v.classList.toggle("active",v.id===id));
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("[data-go]").forEach(el=>{
  el.addEventListener("click",e=>{
    e.preventDefault();
    show(el.dataset.go);
  });
});

document.getElementById("applicationForm").addEventListener("submit",e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const ok=f.get("rights")==="yes" && f.get("tfn")==="yes";
  document.getElementById("eligibilityError").classList.toggle("hidden",ok);
  if(!ok) return;
  localStorage.setItem("azzurroApplicant",JSON.stringify(Object.fromEntries(f.entries())));
  current=0;
  renderQuestion();
  show("interview");
});

function renderQuestion(){
  const q=questions[current];
  document.getElementById("category").textContent=q.category;
  document.getElementById("questionTitle").textContent=`Question ${current+1} of 5`;
  document.getElementById("questionText").textContent=q.text;
  document.getElementById("ringText").textContent=`${(current+1)*20}%`;
  document.getElementById("nextBtn").disabled=true;
  document.getElementById("recordBtn").textContent="● Start recording";
  document.getElementById("recordBadge").classList.add("hidden");
  recording=false;
}
renderQuestion();

document.getElementById("enableCamera").addEventListener("click",async()=>{
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    const video=document.getElementById("preview");
    video.srcObject=stream;
    document.getElementById("cameraPlaceholder").classList.add("hidden");
  }catch(err){
    alert("Camera or microphone access was not granted. You can still preview the rest of the interface.");
  }
});

document.getElementById("recordBtn").addEventListener("click",()=>{
  recording=!recording;
  const recordBtn=document.getElementById("recordBtn");
  const badge=document.getElementById("recordBadge");
  if(recording){
    recordBtn.textContent="■ Stop recording";
    badge.classList.remove("hidden");
  }else{
    recordBtn.textContent="↻ Retake answer";
    badge.classList.add("hidden");
    document.getElementById("nextBtn").disabled=false;
  }
});

document.getElementById("nextBtn").addEventListener("click",()=>{
  if(current<questions.length-1){
    current++;
    renderQuestion();
  }else{
    if(stream) stream.getTracks().forEach(t=>t.stop());
    show("thanks");
  }
});