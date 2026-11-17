const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const toast = (msg) => { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2600); };
const titles={overview:"Overview",assistant:"AI Assistant",contacts:"Contacts & CRM",support:"Customer Support",content:"Content Studio",automations:"Automations",billing:"Plans & Billing",settings:"Settings"};
function navigate(page){if(!titles[page])return; $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`)); $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page)); $("#crumbCurrent").textContent=titles[page]; $("#sidebar").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"});}
$$("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));

const defaultContacts=[
 {id:1,name:"Jordan Davis",email:"jordan@northstar.studio",company:"Northstar Studio",status:"Active",date:"Today"},
 {id:2,name:"Sarah Kim",email:"sarah@brightlabs.co",company:"Bright Labs",status:"Lead",date:"Yesterday"},
 {id:3,name:"Mateo Rivera",email:"mateo@orbitdigital.com",company:"Orbit Digital",status:"Active",date:"Oct 21"}
];
let contacts=JSON.parse(localStorage.getItem("nexora_contacts")||"null")||defaultContacts;
function saveContacts(){localStorage.setItem("nexora_contacts",JSON.stringify(contacts));}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();}
function renderContacts(){
 const body=$("#contactsTable"); if(!body)return;
 const q=($("#contactSearch")?.value||"").toLowerCase();
 const filtered=contacts.filter(c=>[c.name,c.email,c.company,c.status].join(" ").toLowerCase().includes(q));
 body.innerHTML=filtered.map(c=>`<tr><td><div class="person"><span class="mini-avatar">${initials(c.name)}</span>${escapeHtml(c.name)}</div></td><td>${escapeHtml(c.email)}</td><td>${escapeHtml(c.company||"—")}</td><td><span class="tag ${c.status==="Active"?"active-tag":"lead-tag"}">${escapeHtml(c.status)}</span></td><td><button class="text-btn delete-contact" data-id="${c.id}">Remove</button></td></tr>`).join("");
 $("#contactsEmpty").hidden=filtered.length>0;
 $("#crmTotal").textContent=contacts.length; $("#crmActive").textContent=contacts.filter(c=>c.status==="Active").length; $("#crmLeads").textContent=contacts.filter(c=>c.status==="Lead").length;
 $("#statContacts").textContent=128+Math.max(0,contacts.length-3);
 $("#recentContacts").innerHTML=contacts.slice(-3).reverse().map(c=>`<tr><td><div class="person"><span class="mini-avatar">${initials(c.name)}</span>${escapeHtml(c.name)}</div></td><td>${escapeHtml(c.company||"—")}</td><td><span class="tag ${c.status==="Active"?"active-tag":"lead-tag"}">${escapeHtml(c.status)}</span></td><td>${escapeHtml(c.date)}</td></tr>`).join("");
 $$(".delete-contact").forEach(b=>b.addEventListener("click",()=>{contacts=contacts.filter(c=>String(c.id)!==b.dataset.id);saveContacts();renderContacts();toast("Contact removed from this browser.");}));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
renderContacts();
$("#contactSearch").addEventListener("input",renderContacts);
const dialog=$("#contactDialog");
$("#addContactBtn").addEventListener("click",()=>dialog.showModal());
$("#contactForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#newName").value.trim(),email=$("#newEmail").value.trim();if(!name||!email)return;contacts.push({id:Date.now(),name,email,company:$("#newCompany").value.trim(),status:$("#newStatus").value,date:"Just now"});saveContacts();renderContacts();dialog.close();e.target.reset();toast("Contact added to this browser.");});
$("#newTicketBtn").addEventListener("click",()=>toast("Support ticket creation will be enabled with the backend phase."));
$("#automationInfo").addEventListener("click",()=>toast("Automation workflows are planned for a future release."));
$$("[data-plan]").forEach(b=>b.addEventListener("click",()=>toast(`${b.dataset.plan} checkout is not connected yet. No payment has been taken.`)));

const chatMessages=$("#chatMessages");
function addMessage(text,who){const el=document.createElement("div");el.className=who==="user"?"message user-message":"message assistant-message";if(who==="assistant"){el.innerHTML=`<div class="message-avatar">N</div><div><b>NEXORA AI · DEMO</b><p>${escapeHtml(text)}</p></div>`;}else{el.textContent=text;}chatMessages.append(el);chatMessages.scrollTop=chatMessages.scrollHeight;}
function demoReply(prompt){
 const p=prompt.toLowerCase();
 if(p.includes("welcome")||p.includes("email"))return "Subject: Welcome to our community!\\n\\nHi [Customer Name],\\n\\nThank you for choosing us. We're delighted to have you with us. Our team is here to help you get the most from your experience. If you have any questions, simply reply to this email.\\n\\nWarm regards,\\n[Your Business Team]";
 if(p.includes("marketing")||p.includes("idea"))return "Here are five practical starting points:\\n\\n1. Share a useful customer tip each week.\\n2. Turn a customer question into a short educational post.\\n3. Ask happy customers for a review.\\n4. Create a simple referral offer.\\n5. Send a helpful monthly email with one clear call to action.\\n\\nChoose one idea and test it with a small audience first.";
 if(p.includes("follow"))return "A simple follow-up plan:\\n\\nDay 0 — Send a personal thank-you and recap the customer's need.\\nDay 2 — Share one useful resource or answer a likely question.\\nDay 5 — Ask whether they would like to discuss next steps.\\n\\nKeep messages relevant, respectful and easy to opt out of.";
 return "Thanks for sharing that. A useful next step is to define the goal, the audience and the action you want them to take. I can help turn this into a short plan.\\n\\nNote: this is a sample response in the NEXORA preview. Connect a live AI API to enable real AI answers.";
}
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const input=$("#chatInput"),v=input.value.trim();if(!v)return;addMessage(v,"user");input.value="";setTimeout(()=>addMessage(demoReply(v),"assistant"),350);});
$$(".suggestions button").forEach(b=>b.addEventListener("click",()=>{$("#chatInput").value=b.textContent;$("#chatForm").requestSubmit();}));
$$(".prompt-sample").forEach(b=>b.addEventListener("click",()=>{$("#chatInput").value=b.dataset.prompt;$("#chatForm").requestSubmit();}));
$("#clearChat").addEventListener("click",()=>{chatMessages.innerHTML='<div class="message assistant-message"><div class="message-avatar">N</div><div><b>NEXORA AI</b><p>Hi there! I\\'m your business assistant. What are we working on today?</p></div></div>';});
$("#contentForm").addEventListener("submit",e=>{e.preventDefault();const type=$("#contentType").value,brief=$("#contentBrief").value.trim();if(!brief){toast("Please add a topic or brief first.");return;}let draft;if(type==="Marketing email")draft=`Subject: A quick update about ${brief}\\n\\nHi [Name],\\n\\nWe wanted to share an update about ${brief}. We believe this can help you get more value from your experience with us.\\n\\nWould you like to learn more? Reply to this email and our team will be happy to help.\\n\\nBest,\\n[Your Team]`;else if(type==="Product description")draft=`${brief}\\n\\nDesigned with your needs in mind, this solution helps simplify your workflow and make everyday tasks easier. Discover the benefits and see how it can fit into your routine.`;else if(type==="Blog outline")draft=`# ${brief}\\n\\n1. Introduction: why this topic matters\\n2. The common challenges\\n3. Practical steps and recommendations\\n4. Mistakes to avoid\\n5. Key takeaways and next steps`;else draft=`${brief}\\n\\nBig ideas start with small steps. We're excited to share this with our community. What do you think? Tell us below.\\n\\n#Business #Innovation #NEXORAAI`;$("#draftOutput").textContent=draft;$("#draftStatus").textContent="Sample draft created · Demo mode";});
$("#copyDraft").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("#draftOutput").textContent);toast("Draft copied.");}catch{toast("Clipboard permission unavailable in this browser.");}});
$("#workspaceForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#workspaceName").value.trim();if(name){$(".workspace-switch b").textContent=name;localStorage.setItem("nexora_workspace",name);toast("Workspace name saved in this browser.");}});
const savedWorkspace=localStorage.getItem("nexora_workspace");if(savedWorkspace){$("#workspaceName").value=savedWorkspace;$(".workspace-switch b").textContent=savedWorkspace;}
