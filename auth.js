let isSignup=false, supabaseClient=null;
async function initAuth(){
 const cfg=await fetch("/config.js").then(r=>r.json());
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){$("#authError").textContent="Supabase is not configured yet. Add the required environment variables on your hosting server.";$("#submitBtn").disabled=true;return;}
 supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(session) location.href="/";
}
const $=s=>document.querySelector(s);
$("#switchMode").addEventListener("click",()=>{isSignup=!isSignup;$("#formTitle").textContent=isSignup?"Create your account":"Welcome back";$("#formSubtitle").textContent=isSignup?"Start your NEXORA AI workspace.":"Sign in to continue to your business workspace.";$("#submitBtn").textContent=isSignup?"Create account":"Sign in";$("#switchText").innerHTML=isSignup?'Already have an account? <button id="switchMode" type="button">Sign in</button>':'New to NEXORA? <button id="switchMode" type="button">Create an account</button>';$("#switchMode").addEventListener("click",()=>{isSignup=!isSignup;location.reload();});});
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();$("#authError").textContent="";if(!supabaseClient)return;$("#submitBtn").disabled=true;$("#submitBtn").textContent="Please wait…";
 try{const email=$("#email").value.trim(),password=$("#password").value;const result=isSignup?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});if(result.error)throw result.error;if(isSignup&&!result.data.session){$("#authError").textContent="Check your email for the confirmation link, then sign in.";return;}location.href="/";}
 catch(err){$("#authError").textContent=err.message||"Unable to authenticate.";}
 finally{$("#submitBtn").disabled=false;$("#submitBtn").textContent=isSignup?"Create account":"Sign in";}
});
initAuth();