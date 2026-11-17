import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const PORT=Number(process.env.PORT||3000);
const required=["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"];
const missing=required.filter(k=>!process.env[k]);
const supabaseAdmin=process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY
 ? createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 : null;
const supabaseAuth=process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY
 ? createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 : null;
const openai=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;

app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(cors({origin:process.env.APP_ORIGIN||true,credentials:false}));
app.get("/config.js",(_req,res)=>res.json({
 supabaseUrl:process.env.SUPABASE_URL||"",
 supabaseAnonKey:process.env.SUPABASE_ANON_KEY||"",
 paddleClientToken:process.env.PADDLE_CLIENT_TOKEN||"",
 paddleEnvironment:process.env.PADDLE_ENVIRONMENT||"sandbox"
}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/api",rateLimit({windowMs:60_000,limit:60,standardHeaders:"draft-7",legacyHeaders:false}));
app.use(express.json({limit:"1mb"}));

async function auth(req,res,next){
 try{
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({error:"Sign in required"});
  if(!supabaseAuth||!supabaseAdmin)return res.status(503).json({error:"Database authentication is not configured"});
  const {data,error}=await supabaseAuth.auth.getUser(token);
  if(error||!data.user)return res.status(401).json({error:"Invalid or expired session"});
  req.user=data.user;next();
 }catch(e){res.status(401).json({error:"Authentication failed"});}
}
const safeError=(res,e)=>{console.error(e);res.status(500).json({error:"Something went wrong. Please try again."});};

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"NEXORA AI",configured:{supabase:!!supabaseAdmin,ai:!!openai,paddle:!!process.env.PADDLE_API_KEY}}));

app.get("/api/me",auth,async(req,res)=>{
 const {data,error}=await supabaseAdmin.from("profiles").select("id,email,full_name,created_at").eq("id",req.user.id).maybeSingle();
 if(error)return safeError(res,error);
 res.json({user:req.user,profile:data});
});

app.get("/api/contacts",auth,async(req,res)=>{
 const {data,error}=await supabaseAdmin.from("contacts").select("id,name,email,company,status,created_at").eq("owner_id",req.user.id).order("created_at",{ascending:false}).limit(500);
 if(error)return safeError(res,error);res.json({contacts:data});
});
app.post("/api/contacts",auth,async(req,res)=>{
 const {name,email,company="",status="Lead"}=req.body||{};
 if(typeof name!=="string"||name.trim().length<2||typeof email!=="string"||!/^.+@.+\..+$/.test(email))return res.status(400).json({error:"Valid name and email are required"});
 if(!["Lead","Active"].includes(status))return res.status(400).json({error:"Invalid contact status"});
 const {data,error}=await supabaseAdmin.from("contacts").insert({owner_id:req.user.id,name:name.trim().slice(0,120),email:email.trim().slice(0,254),company:String(company).slice(0,160),status}).select().single();
 if(error)return safeError(res,error);res.status(201).json({contact:data});
});
app.delete("/api/contacts/:id",auth,async(req,res)=>{
 const {error}=await supabaseAdmin.from("contacts").delete().eq("id",req.params.id).eq("owner_id",req.user.id);
 if(error)return safeError(res,error);res.status(204).end();
});

const aiLimiter=rateLimit({windowMs:60_000,limit:10,standardHeaders:"draft-7",legacyHeaders:false});
app.post("/api/ai/chat",auth,aiLimiter,async(req,res)=>{
 try{
  if(!openai)return res.status(503).json({error:"AI provider is not configured. Add OPENAI_API_KEY on the server."});
  const message=String(req.body?.message||"").trim();
  if(!message||message.length>6000)return res.status(400).json({error:"Message must be between 1 and 6000 characters"});
  const {data:usage,error:usageErr}=await supabaseAdmin.from("profiles").select("monthly_ai_requests,monthly_ai_limit").eq("id",req.user.id).single();
  if(usageErr)return safeError(res,usageErr);
  if((usage.monthly_ai_requests||0)>=(usage.monthly_ai_limit||100))return res.status(429).json({error:"Monthly AI usage limit reached. Upgrade your plan to continue."});
  const completion=await openai.chat.completions.create({
   model:process.env.OPENAI_MODEL||"gpt-4o-mini",
   messages:[
    {role:"system",content:"You are NEXORA AI, a practical business assistant. Give concise, useful, safe business help. Do not claim to perform actions in external systems."},
    {role:"user",content:message}
   ],max_tokens:700
  });
  await supabaseAdmin.from("profiles").update({monthly_ai_requests:(usage.monthly_ai_requests||0)+1}).eq("id",req.user.id);
  res.json({reply:completion.choices?.[0]?.message?.content||"",usage:{used:(usage.monthly_ai_requests||0)+1,limit:usage.monthly_ai_limit||100}});
 }catch(e){safeError(res,e);}
});

// Paddle Billing webhook: verify signature against the exact raw request body.
app.post("/api/webhooks/paddle",express.raw({type:"application/json"}),async(req,res)=>{
 try{
  const secret=process.env.PADDLE_WEBHOOK_SECRET;
  if(!secret)return res.status(503).send("Webhook not configured");
  const header=req.headers["paddle-signature"]||"";
  const parts=Object.fromEntries(header.split(";").map(x=>x.split("=")));
  const ts=parts.ts,signature=parts.h1;
  if(!ts||!signature)return res.status(400).send("Missing signature");
  const signedPayload=`${ts}:${req.body.toString("utf8")}`;
  const expected=crypto.createHmac("sha256",secret).update(signedPayload).digest("hex");
  const a=Buffer.from(expected,"hex"),b=Buffer.from(signature,"hex");
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).send("Invalid signature");
  const event=JSON.parse(req.body.toString("utf8"));
  const d=event.data||{};
  const userId=d.custom_data?.user_id||d.custom_data?.userId;
  if(["subscription.created","subscription.updated","subscription.canceled","subscription.paused","subscription.resumed"].includes(event.event_type)){
   if(!userId)return res.status(202).send("Accepted: no linked user id");
   const status=d.status||"inactive";
   await supabaseAdmin.from("subscriptions").upsert({
    user_id:userId,provider:"paddle",provider_subscription_id:d.id,
    status,price_id:d.items?.[0]?.price?.id||null,
    current_period_end:d.current_billing_period?.ends_at||null,
    updated_at:new Date().toISOString()
   },{onConflict:"provider_subscription_id"});
   const plan=status==="active"||status==="trialing"?"paid":"free";
   await supabaseAdmin.from("profiles").update({plan}).eq("id",userId);
  }
  res.status(200).send("ok");
 }catch(e){console.error("Paddle webhook error",e);res.status(400).send("Webhook processing failed");}
});

// Billing endpoint returns the configured Paddle public checkout identifiers only.
// Checkout is intentionally not activated until a verified Paddle seller account and price IDs exist.
app.get("/api/billing/config",auth,(_req,res)=>res.json({
 clientToken:process.env.PADDLE_CLIENT_TOKEN||"",
 environment:process.env.PADDLE_ENVIRONMENT||"sandbox",
 prices:{starter:process.env.PADDLE_STARTER_PRICE_ID||"",pro:process.env.PADDLE_PRO_PRICE_ID||"",business:process.env.PADDLE_BUSINESS_PRICE_ID||""}
}));

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>{console.log(`NEXORA AI listening on ${PORT}`);if(missing.length)console.warn("Missing required environment variables:",missing.join(", "));});
