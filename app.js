const views=[...document.querySelectorAll(".screen")];
const cfg=window.AZZURRO_CONFIG||{};
const sb=(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY)
  ? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY)
  : null;

const questions=[
 {category:"CLEANING QUALITY",text:"After cleaning a room, what are the final things you would check before marking it as ready for the next guest?"},
 {category:"TASKS & COMMUNICATION",text:"At Azzurro Hotels, you may receive and update your daily work through a task list and communicate with our remote reception team. Are you comfortable working this way, keeping tasks updated, and communicating with remote reception to make sure everything is taken care of?"},
 {category:"BUSY OPERATIONS",text:"It is a busy day and several rooms still need to be prepared before guests arrive. How would you manage your tasks to make sure rooms are cleaned properly and ready on time?"},
 {category:"MAINTENANCE & REPORTING",text:"While cleaning, you notice something isn't working properly, such as an air conditioner, bathroom light, or damaged fixture. What would you do?"},
 {category:"INTEGRITY",text:"While cleaning a room after checkout, you find cash or another valuable item that appears to have been left behind by a guest. What would you do?"}
];

let current=0, stream=null, recorder=null, chunks=[], recording=false;
let applicationId=sessionStorage.getItem("azzurroApplicationId");
let submissionToken=sessionStorage.getItem("azzurroSubmissionToken");

function show(id){
  views.forEach(v=>v.classList.toggle("active",v.id===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",e=>{
  e.preventDefault(); show(el.dataset.go);
}));

function uuid(){
  if(window.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
    const r=Math.random()*16|0,v=c==="x"?r:(r&0x3|0x8);return v.toString(16);
  });
}

function safeExt(name,fallback="pdf"){
  const ext=(name?.split(".").pop()||fallback).toLowerCase().replace(/[^a-z0-9]/g,"");
  return ext||fallback;
}

async function uploadResume(file,id,token,path){
  if(!file||!sb) return null;
  const {error}=await sb.storage.from("resumes").upload(path,file,{
    upsert:false,
    contentType:file.type||undefined
  });
  if(error) throw error;
  return path;
}

document.getElementById("applicationForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=e.submitter;
  const f=new FormData(e.target);
  const ok=f.get("rights")==="yes" && f.get("tfn")==="yes";
  document.getElementById("eligibilityError").classList.toggle("hidden",ok);
  if(!ok) return;
  if(!sb){ alert("The application service is unavailable. Please try again later."); return; }

  btn.disabled=true; btn.textContent="Saving application…";

  applicationId=uuid();
  submissionToken=uuid();
  const resume=document.getElementById("resume").files[0];
  const resumePath=resume ? `${applicationId}/${submissionToken}/resume.${safeExt(resume.name)}` : null;

  try{
    const payload={
      id:applicationId,
      submission_token:submissionToken,
      first_name:f.get("firstName"),
      last_name:f.get("lastName"),
      email:f.get("email"),
      mobile:f.get("phone"),
      whatsapp:f.get("whatsapp"),
      suburb:f.get("suburb"),
      start_date:f.get("startDate")||null,
      experience:f.get("experience"),
      weekends:f.get("weekends")==="on",
      public_holidays:f.get("holidays")==="on",
      most_days:f.get("mostdays")==="on",
      australian_work_rights:true,
      tfn_eligible:true,
      resume_path:resumePath
    };

    const {error}=await sb.from("applications").insert(payload);
    if(error) throw error;

    if(resume) await uploadResume(resume,applicationId,submissionToken,resumePath);

    sessionStorage.setItem("azzurroApplicationId",applicationId);
    sessionStorage.setItem("azzurroSubmissionToken",submissionToken);
    current=0; renderQuestion(); show("interview");
  }catch(err){
    console.error(err);
    alert("We couldn't submit your application. Please check your connection and try again.");
    applicationId=null; submissionToken=null;
  }finally{
    btn.disabled=false;
    btn.innerHTML='Continue to video interview <span>→</span>';
  }
});

function renderQuestion(){
  const q=questions[current];
  document.getElementById("category").textContent=q.category;
  document.getElementById("questionTitle").textContent=`Question ${current+1} of 5`;
  document.getElementById("questionText").textContent=q.text;
  document.getElementById("ringText").textContent=`${(current+1)*20}%`;
  document.getElementById("nextBtn").disabled=true;
  const rb=document.getElementById("recordBtn");
  rb.textContent="● Start recording"; rb.disabled=false;
  document.getElementById("recordBadge").classList.add("hidden");
  recording=false;
}
renderQuestion();

document.getElementById("enableCamera").addEventListener("click",async()=>{
  try{
    if(!navigator.mediaDevices?.getUserMedia){
      throw new Error("Camera recording is not supported by this browser.");
    }
    stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},
      audio:{echoCancellation:true,noiseSuppression:true}
    });
    const preview=document.getElementById("preview");
    preview.srcObject=stream;
    preview.muted=true;
    await preview.play().catch(()=>{});
    document.getElementById("cameraPlaceholder").classList.add("hidden");
  }catch(err){
    console.error(err);
    alert("Camera and microphone access are required. Please allow permissions in your browser settings and try again.");
  }
});

function preferredMimeType(){
  if(!window.MediaRecorder) return "";
  const types=[
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return types.find(t=>MediaRecorder.isTypeSupported?.(t))||"";
}

async function saveVideo(blob,mimeType){
  applicationId ||= sessionStorage.getItem("azzurroApplicationId");
  submissionToken ||= sessionStorage.getItem("azzurroSubmissionToken");
  if(!applicationId||!submissionToken||!sb) throw new Error("Application session missing.");

  const n=current+1;
  const isMp4=(mimeType||blob.type||"").includes("mp4");
  const ext=isMp4?"mp4":"webm";
  const path=`${applicationId}/${submissionToken}/question-${n}-${uuid()}.${ext}`;

  const {error:uploadError}=await sb.storage.from("interview-videos").upload(path,blob,{
    contentType:mimeType||blob.type||`video/${ext}`,
    upsert:false
  });
  if(uploadError) throw uploadError;

  const q=questions[current];
  const {error}=await sb.rpc("submit_interview_response",{
    p_application_id:applicationId,
    p_submission_token:submissionToken,
    p_question_number:n,
    p_category:q.category,
    p_question:q.text,
    p_video_path:path
  });
  if(error) throw error;
}

document.getElementById("recordBtn").addEventListener("click",async()=>{
  const rb=document.getElementById("recordBtn");
  if(!stream){ alert("Please enable your camera and microphone first."); return; }
  if(!window.MediaRecorder){ alert("Video recording is not supported by this browser. Please use a current version of Safari, Chrome, or Edge."); return; }

  if(!recording){
    chunks=[];
    const mime=preferredMimeType();
    try{
      recorder=mime ? new MediaRecorder(stream,{mimeType:mime}) : new MediaRecorder(stream);
    }catch{
      recorder=new MediaRecorder(stream);
    }

    recorder.ondataavailable=e=>{ if(e.data?.size) chunks.push(e.data); };
    recorder.onerror=e=>{ console.error(e); alert("Recording stopped because of a browser error. Please try this question again."); };
    recorder.onstop=async()=>{
      rb.disabled=true; rb.textContent="Uploading answer…";
      try{
        const type=recorder.mimeType||preferredMimeType()||"video/webm";
        const blob=new Blob(chunks,{type});
        if(blob.size<1000) throw new Error("Recording was empty.");
        await saveVideo(blob,type);
        rb.textContent="✓ Answer recorded";
        document.getElementById("nextBtn").disabled=false;
      }catch(err){
        console.error(err);
        rb.disabled=false; rb.textContent="Upload failed — record again";
        alert("Your answer was not saved, so it does not count as an attempt. Please check your connection and record this question again.");
      }
    };

    recorder.start(1000);
    recording=true;
    rb.textContent="■ Stop recording";
    document.getElementById("recordBadge").classList.remove("hidden");
  }else{
    recording=false;
    document.getElementById("recordBadge").classList.add("hidden");
    if(recorder?.state!=="inactive") recorder.stop();
  }
});

document.getElementById("nextBtn").addEventListener("click",async()=>{
  if(current<questions.length-1){
    current++; renderQuestion(); return;
  }
  const next=document.getElementById("nextBtn");
  next.disabled=true; next.textContent="Submitting…";
  try{
    const {error}=await sb.rpc("complete_application",{
      p_application_id:applicationId,
      p_submission_token:submissionToken
    });
    if(error) throw error;
    if(stream) stream.getTracks().forEach(t=>t.stop());
    sessionStorage.removeItem("azzurroApplicationId");
    sessionStorage.removeItem("azzurroSubmissionToken");
    show("thanks");
  }catch(err){
    console.error(err);
    alert("Your five answers are saved, but we couldn't finalise the application. Please check your connection and tap Continue again.");
    next.disabled=false; next.innerHTML='Continue <span>→</span>';
  }
});

window.addEventListener("beforeunload",()=>{
  if(stream) stream.getTracks().forEach(t=>t.stop());
});
