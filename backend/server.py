import os
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import db
from auth import auth_router, get_current_user, seed_admin
import ai_service
from seo_scanner import scan_website

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("venturelyx")

app = FastAPI(title="Venturelyx API")
api = APIRouter(prefix="/api")

LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------------- business context ----------------
async def get_business(user: dict) -> dict:
    biz = await db.businesses.find_one({"owner_id": user["id"]}, {"_id": 0})
    return biz


async def require_business(user: dict = Depends(get_current_user)) -> dict:
    biz = await get_business(user)
    if not biz:
        raise HTTPException(status_code=404, detail="No business found. Complete onboarding first.")
    return biz


# ===================== ONBOARDING / BUSINESS =====================
class BusinessInput(BaseModel):
    name: str
    website: str = ""
    industry: str = ""
    service_area: str = ""


@api.get("/business")
async def read_business(user: dict = Depends(get_current_user)):
    biz = await get_business(user)
    return biz or None


@api.post("/business")
async def create_business(body: BusinessInput, user: dict = Depends(get_current_user)):
    existing = await get_business(user)
    payload = body.model_dump()
    if existing:
        await db.businesses.update_one({"id": existing["id"]}, {"$set": {**payload, "updated_at": now_iso()}})
        return clean(await db.businesses.find_one({"id": existing["id"]}, {"_id": 0}))

    biz = {
        "id": f"biz_{uuid.uuid4().hex[:12]}",
        "org_id": f"org_{uuid.uuid4().hex[:12]}",
        "owner_id": user["id"],
        **payload,
        "ai_provider_pref": "auto",
        "created_at": now_iso(),
    }
    await db.businesses.insert_one(dict(biz))
    await seed_demo_data(biz["id"])
    return clean(biz)


class AIPrefInput(BaseModel):
    ai_provider_pref: str


@api.put("/business/ai-preference")
async def set_ai_pref(body: AIPrefInput, biz: dict = Depends(require_business)):
    pref = body.ai_provider_pref if body.ai_provider_pref in ("auto", "anthropic", "openai") else "auto"
    await db.businesses.update_one({"id": biz["id"]}, {"$set": {"ai_provider_pref": pref}})
    return {"ai_provider_pref": pref}


# ===================== LEADS (CRM pipeline) =====================
class LeadInput(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    value: float = 0
    stage: str = "new"
    source: str = "manual"
    notes: str = ""


@api.get("/leads")
async def list_leads(biz: dict = Depends(require_business)):
    rows = await db.leads.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api.post("/leads")
async def create_lead(body: LeadInput, biz: dict = Depends(require_business)):
    lead = {"id": f"lead_{uuid.uuid4().hex[:10]}", "business_id": biz["id"], **body.model_dump(),
            "created_at": now_iso(), "updated_at": now_iso()}
    await db.leads.insert_one(dict(lead))
    return clean(lead)


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: dict = Body(...), biz: dict = Depends(require_business)):
    body.pop("id", None); body.pop("_id", None); body.pop("business_id", None)
    body["updated_at"] = now_iso()
    res = await db.leads.update_one({"id": lead_id, "business_id": biz["id"]}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return clean(await db.leads.find_one({"id": lead_id}, {"_id": 0}))


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, biz: dict = Depends(require_business)):
    await db.leads.delete_one({"id": lead_id, "business_id": biz["id"]})
    return {"ok": True}


# ===================== JOBS =====================
class JobInput(BaseModel):
    title: str
    customer_name: str = ""
    scheduled_date: str = ""
    status: str = "scheduled"
    value: float = 0
    notes: str = ""


@api.get("/jobs")
async def list_jobs(biz: dict = Depends(require_business)):
    return await db.jobs.find({"business_id": biz["id"]}, {"_id": 0}).sort("scheduled_date", 1).to_list(500)


@api.post("/jobs")
async def create_job(body: JobInput, biz: dict = Depends(require_business)):
    job = {"id": f"job_{uuid.uuid4().hex[:10]}", "business_id": biz["id"], **body.model_dump(), "created_at": now_iso()}
    await db.jobs.insert_one(dict(job))
    return clean(job)


@api.put("/jobs/{job_id}")
async def update_job(job_id: str, body: dict = Body(...), biz: dict = Depends(require_business)):
    body.pop("id", None); body.pop("_id", None); body.pop("business_id", None)
    res = await db.jobs.update_one({"id": job_id, "business_id": biz["id"]}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return clean(await db.jobs.find_one({"id": job_id}, {"_id": 0}))


@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, biz: dict = Depends(require_business)):
    await db.jobs.delete_one({"id": job_id, "business_id": biz["id"]})
    return {"ok": True}


# ===================== INVOICES =====================
class InvoiceInput(BaseModel):
    customer_name: str
    amount: float = 0
    status: str = "draft"
    issued_date: str = ""
    due_date: str = ""
    notes: str = ""


@api.get("/invoices")
async def list_invoices(biz: dict = Depends(require_business)):
    return await db.invoices.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/invoices")
async def create_invoice(body: InvoiceInput, biz: dict = Depends(require_business)):
    count = await db.invoices.count_documents({"business_id": biz["id"]})
    inv = {"id": f"inv_{uuid.uuid4().hex[:10]}", "business_id": biz["id"],
           "number": f"INV-{1001 + count}", **body.model_dump(), "created_at": now_iso()}
    await db.invoices.insert_one(dict(inv))
    return clean(inv)


@api.put("/invoices/{inv_id}")
async def update_invoice(inv_id: str, body: dict = Body(...), biz: dict = Depends(require_business)):
    body.pop("id", None); body.pop("_id", None); body.pop("business_id", None)
    res = await db.invoices.update_one({"id": inv_id, "business_id": biz["id"]}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Invoice not found")
    return clean(await db.invoices.find_one({"id": inv_id}, {"_id": 0}))


@api.delete("/invoices/{inv_id}")
async def delete_invoice(inv_id: str, biz: dict = Depends(require_business)):
    await db.invoices.delete_one({"id": inv_id, "business_id": biz["id"]})
    return {"ok": True}


# ===================== REVIEWS =====================
class ReviewInput(BaseModel):
    author: str
    rating: int = 5
    text: str = ""
    source: str = "Google"


@api.get("/reviews")
async def list_reviews(biz: dict = Depends(require_business)):
    return await db.reviews.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/reviews")
async def create_review(body: ReviewInput, biz: dict = Depends(require_business)):
    rev = {"id": f"rev_{uuid.uuid4().hex[:10]}", "business_id": biz["id"], **body.model_dump(),
           "response": "", "response_status": "none", "created_at": now_iso()}
    await db.reviews.insert_one(dict(rev))
    return clean(rev)


@api.put("/reviews/{rev_id}")
async def update_review(rev_id: str, body: dict = Body(...), biz: dict = Depends(require_business)):
    body.pop("id", None); body.pop("_id", None); body.pop("business_id", None)
    res = await db.reviews.update_one({"id": rev_id, "business_id": biz["id"]}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Review not found")
    return clean(await db.reviews.find_one({"id": rev_id}, {"_id": 0}))


# ===================== SCALESEO =====================
class ScanInput(BaseModel):
    url: str


@api.post("/seo/scan")
async def seo_scan(body: ScanInput, biz: dict = Depends(require_business)):
    result = await asyncio.to_thread(scan_website, body.url)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    audit = {
        "id": f"audit_{uuid.uuid4().hex[:10]}",
        "business_id": biz["id"],
        **result,
        "created_at": now_iso(),
    }
    await db.seo_audits.insert_one(dict(audit))
    return clean(audit)


@api.get("/seo/audits")
async def seo_audits(biz: dict = Depends(require_business)):
    return await db.seo_audits.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


class KeywordInput(BaseModel):
    keyword: str
    position: int = 0
    volume: int = 0
    difficulty: int = 0


@api.get("/seo/keywords")
async def list_keywords(biz: dict = Depends(require_business)):
    return await db.keywords.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/seo/keywords")
async def add_keyword(body: KeywordInput, biz: dict = Depends(require_business)):
    kw = {"id": f"kw_{uuid.uuid4().hex[:8]}", "business_id": biz["id"], **body.model_dump(), "created_at": now_iso()}
    await db.keywords.insert_one(dict(kw))
    return clean(kw)


@api.delete("/seo/keywords/{kw_id}")
async def del_keyword(kw_id: str, biz: dict = Depends(require_business)):
    await db.keywords.delete_one({"id": kw_id, "business_id": biz["id"]})
    return {"ok": True}


class CompetitorInput(BaseModel):
    name: str
    domain: str = ""
    seo_score: int = 0
    notes: str = ""


@api.get("/seo/competitors")
async def list_competitors(biz: dict = Depends(require_business)):
    return await db.competitors.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/seo/competitors")
async def add_competitor(body: CompetitorInput, biz: dict = Depends(require_business)):
    c = {"id": f"comp_{uuid.uuid4().hex[:8]}", "business_id": biz["id"], **body.model_dump(), "created_at": now_iso()}
    await db.competitors.insert_one(dict(c))
    return clean(c)


@api.delete("/seo/competitors/{c_id}")
async def del_competitor(c_id: str, biz: dict = Depends(require_business)):
    await db.competitors.delete_one({"id": c_id, "business_id": biz["id"]})
    return {"ok": True}


# ===================== DASHBOARD =====================
def growth_score(seo, reviews_avg, review_count, pipeline, won_count, paid_revenue):
    seo_c = (seo / 100) * 30
    rev_c = min(review_count / 20, 1) * (reviews_avg / 5) * 20
    pipe_c = min(pipeline / 20000, 1) * 20
    win_c = min(won_count / 10, 1) * 15
    money_c = min(paid_revenue / 20000, 1) * 15
    return round(seo_c + rev_c + pipe_c + win_c + money_c)


@api.get("/dashboard")
async def dashboard(biz: dict = Depends(require_business)):
    leads = await db.leads.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    reviews = await db.reviews.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    jobs = await db.jobs.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    latest_audit = await db.seo_audits.find_one({"business_id": biz["id"]}, {"_id": 0}, sort=[("created_at", -1)])

    open_leads = [l for l in leads if l["stage"] not in ("won", "lost")]
    won = [l for l in leads if l["stage"] == "won"]
    pipeline = sum(l.get("value", 0) for l in open_leads)
    paid_revenue = sum(i.get("amount", 0) for i in invoices if i.get("status") == "paid")
    outstanding = sum(i.get("amount", 0) for i in invoices if i.get("status") in ("sent", "overdue"))
    reviews_avg = round(sum(r.get("rating", 0) for r in reviews) / len(reviews), 1) if reviews else 0
    seo_score = latest_audit["score"] if latest_audit else 0
    open_jobs = [j for j in jobs if j.get("status") != "completed"]
    expenses = paid_revenue * 0.42  # simple derived operating cost estimate

    gs = growth_score(seo_score, reviews_avg, len(reviews), pipeline, len(won), paid_revenue)

    # pipeline breakdown by stage
    stage_counts = {s: {"count": 0, "value": 0} for s in LEAD_STAGES}
    for l in leads:
        st = l.get("stage", "new")
        if st in stage_counts:
            stage_counts[st]["count"] += 1
            stage_counts[st]["value"] += l.get("value", 0)

    # rule-based next best actions
    actions = []
    if seo_score and seo_score < 75:
        actions.append({"priority": "high", "title": "Fix your website SEO",
                        "detail": f"Your site scored {seo_score}/100. We found things stopping customers from finding you.",
                        "module": "scaleseo"})
    if not latest_audit:
        actions.append({"priority": "high", "title": "Scan your website",
                        "detail": "Run your first SEO scan to see what's helping or hurting you on Google.",
                        "module": "scaleseo"})
    unresponded = [r for r in reviews if r.get("response_status") != "approved" and r.get("rating", 5) <= 3]
    if unresponded:
        actions.append({"priority": "high", "title": f"Respond to {len(unresponded)} unhappy review(s)",
                        "detail": "Replying fast protects your reputation. Let AI draft a reply for you.",
                        "module": "reviews"})
    stale = [l for l in open_leads if l.get("stage") in ("new", "contacted")]
    if stale:
        actions.append({"priority": "medium", "title": f"Follow up with {len(stale)} warm lead(s)",
                        "detail": f"You have ${pipeline:,.0f} in open pipeline waiting to be closed.",
                        "module": "operate"})
    if outstanding > 0:
        actions.append({"priority": "medium", "title": "Chase unpaid invoices",
                        "detail": f"${outstanding:,.0f} is outstanding across sent invoices.",
                        "module": "operate"})
    if reviews_avg and reviews_avg < 4.5:
        actions.append({"priority": "low", "title": "Ask happy customers for reviews",
                        "detail": "More 5-star reviews lift your Google ranking and trust.",
                        "module": "reviews"})

    return {
        "growth_score": gs,
        "metrics": {
            "revenue": paid_revenue,
            "outstanding": outstanding,
            "leads": len(open_leads),
            "customers": len(won),
            "pipeline": pipeline,
            "seo_score": seo_score,
            "reviews_avg": reviews_avg,
            "reviews_count": len(reviews),
            "jobs": len(open_jobs),
            "expenses": round(expenses),
        },
        "pipeline_stages": stage_counts,
        "actions": actions[:5],
        "latest_audit": latest_audit,
    }


# ===================== AI LAYER =====================
def _biz_context(biz: dict) -> str:
    return (f"Business name: {biz.get('name')}. Industry: {biz.get('industry') or 'general'}. "
            f"Website: {biz.get('website') or 'none'}. Service area: {biz.get('service_area') or 'local'}.")


AI_FEATURES = {
    "seo_recommendations": "You are an expert SEO consultant who explains issues in plain English to a busy small-business owner. Be specific, warm, and jargon-free. Use short paragraphs and clear action steps.",
    "page_generation": "You are an expert conversion copywriter and local SEO specialist. Generate complete, ready-to-publish web page content. Return clean sections: TITLE TAG, META DESCRIPTION, H1, INTRO, 3 BENEFIT SECTIONS, 4 FAQs, and a CTA. Write naturally for humans first.",
    "review_response": "You are a gracious business owner replying to a customer review. Keep it authentic, concise, professional, and personalized. Never be defensive.",
    "next_best_action": "You are a growth strategist for small businesses. Given the metrics, suggest the 3 highest-impact next moves in plain English. Be direct and encouraging.",
    "metric_explanation": "You explain business metrics simply to a non-technical owner in 2-3 sentences.",
}


class AIGenInput(BaseModel):
    feature: str
    context: dict = {}


def build_user_prompt(feature: str, biz: dict, ctx: dict) -> str:
    base = _biz_context(biz)
    if feature == "seo_recommendations":
        issues = ctx.get("issues", [])
        lines = "\n".join(f"- {i.get('label')}: {i.get('detail')}" for i in issues) or "No specific issues provided."
        return f"{base}\nOur website scored {ctx.get('score','?')}/100. Issues found:\n{lines}\n\nExplain what these mean for getting more customers, and how to fix them, in priority order."
    if feature == "page_generation":
        return (f"{base}\nGenerate a {ctx.get('page_type','service')} page targeting the keyword "
                f"'{ctx.get('keyword','our main service')}' for the location '{ctx.get('location', biz.get('service_area','our area'))}'. "
                f"Tone: {ctx.get('tone','confident and friendly')}.")
    if feature == "review_response":
        return (f"{base}\nWrite a reply to this {ctx.get('rating','5')}-star review from {ctx.get('author','a customer')}:\n"
                f'"{ctx.get("text","")}"')
    if feature == "next_best_action":
        return f"{base}\nCurrent metrics: {json.dumps(ctx.get('metrics', {}))}. Suggest the 3 best next moves."
    if feature == "metric_explanation":
        return f"{base}\nExplain this metric to the owner: {ctx.get('metric_name')} = {ctx.get('metric_value')}."
    return base


@api.post("/ai/generate/stream")
async def ai_generate_stream(body: AIGenInput, biz: dict = Depends(require_business)):
    if body.feature not in AI_FEATURES:
        raise HTTPException(400, "Unknown AI feature")
    system = AI_FEATURES[body.feature]
    user_text = build_user_prompt(body.feature, biz, body.context)
    provider_pref = biz.get("ai_provider_pref", "auto")

    async def gen():
        async for ev in ai_service.stream_feature(body.feature, system, user_text, biz["id"], provider_pref, biz["id"]):
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


@api.post("/ai/generate")
async def ai_generate(body: AIGenInput, biz: dict = Depends(require_business)):
    if body.feature not in AI_FEATURES:
        raise HTTPException(400, "Unknown AI feature")
    system = AI_FEATURES[body.feature]
    user_text = build_user_prompt(body.feature, biz, body.context)
    provider_pref = biz.get("ai_provider_pref", "auto")
    try:
        text, provider, model = await ai_service.generate_text(body.feature, system, user_text, biz["id"], provider_pref, biz["id"])
    except Exception as e:
        raise HTTPException(502, f"AI generation failed: {e}")
    return {"text": text, "provider": provider, "provider_label": ai_service.PROVIDER_LABEL.get(provider, provider), "model": model}


class SaveGenInput(BaseModel):
    feature: str
    title: str = ""
    output: str
    provider: str = ""
    model: str = ""
    status: str = "draft"


@api.get("/ai/generations")
async def list_generations(biz: dict = Depends(require_business)):
    return await db.ai_generations.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.post("/ai/generations")
async def save_generation(body: SaveGenInput, biz: dict = Depends(require_business)):
    g = {"id": f"gen_{uuid.uuid4().hex[:10]}", "business_id": biz["id"], **body.model_dump(), "created_at": now_iso()}
    await db.ai_generations.insert_one(dict(g))
    return clean(g)


@api.put("/ai/generations/{gen_id}")
async def update_generation(gen_id: str, body: dict = Body(...), biz: dict = Depends(require_business)):
    body.pop("id", None); body.pop("_id", None); body.pop("business_id", None)
    await db.ai_generations.update_one({"id": gen_id, "business_id": biz["id"]}, {"$set": body})
    return clean(await db.ai_generations.find_one({"id": gen_id}, {"_id": 0}))


@api.get("/ai/usage")
async def ai_usage(biz: dict = Depends(require_business)):
    rows = await db.ai_usage.find({"business_id": biz["id"]}, {"_id": 0}).to_list(2000)
    by_provider = {}
    for r in rows:
        p = r.get("provider", "unknown")
        by_provider.setdefault(p, {"calls": 0, "approx_tokens": 0})
        by_provider[p]["calls"] += 1
        by_provider[p]["approx_tokens"] += r.get("approx_tokens", 0)
    return {"total_calls": len(rows), "by_provider": by_provider}


@api.get("/ai/models")
async def ai_models():
    return {"model_map": ai_service.MODEL_MAP, "feature_tier": ai_service.FEATURE_TIER}


# ===================== DEMO SEED =====================
async def seed_demo_data(business_id: str):
    if await db.leads.count_documents({"business_id": business_id}) > 0:
        return
    demo_leads = [
        ("Marcus Bell", "marcus@northgate.co", "Northgate Retail", 4200, "new", "website"),
        ("Priya Nair", "priya@bloomcafe.com", "Bloom Cafe", 1800, "contacted", "referral"),
        ("Tom Alvarez", "tom@alvarezhvac.com", "Alvarez HVAC", 6500, "qualified", "google"),
        ("Dana White", "dana@whitelaw.com", "White Law", 3200, "proposal", "website"),
        ("Sofia Reyes", "sofia@reyesdental.com", "Reyes Dental", 5400, "won", "referral"),
        ("Ken Ito", "ken@itotech.io", "Ito Tech", 2100, "won", "website"),
        ("Ella Fox", "ella@foxfit.com", "Fox Fitness", 1500, "lost", "ads"),
    ]
    for n, e, c, v, s, src in demo_leads:
        await db.leads.insert_one({"id": f"lead_{uuid.uuid4().hex[:10]}", "business_id": business_id,
                                   "name": n, "email": e, "phone": "", "company": c, "value": v,
                                   "stage": s, "source": src, "notes": "", "created_at": now_iso(), "updated_at": now_iso()})
    demo_invoices = [("Reyes Dental", 5400, "paid"), ("Ito Tech", 2100, "paid"),
                     ("White Law", 3200, "sent"), ("Bloom Cafe", 1800, "overdue")]
    for i, (c, a, st) in enumerate(demo_invoices):
        await db.invoices.insert_one({"id": f"inv_{uuid.uuid4().hex[:10]}", "business_id": business_id,
                                      "number": f"INV-{1001+i}", "customer_name": c, "amount": a, "status": st,
                                      "issued_date": "", "due_date": "", "notes": "", "created_at": now_iso()})
    demo_jobs = [("Install & onboarding — Reyes Dental", "Reyes Dental", "completed", 5400),
                 ("Site audit — White Law", "White Law", "scheduled", 3200),
                 ("Discovery call — Alvarez HVAC", "Alvarez HVAC", "in_progress", 6500)]
    for t, c, st, v in demo_jobs:
        await db.jobs.insert_one({"id": f"job_{uuid.uuid4().hex[:10]}", "business_id": business_id,
                                  "title": t, "customer_name": c, "scheduled_date": "", "status": st,
                                  "value": v, "notes": "", "created_at": now_iso()})
    demo_reviews = [("Jennifer M.", 5, "Absolutely fantastic service, went above and beyond!", "Google"),
                    ("Robert K.", 5, "Professional, on time, and great value.", "Google"),
                    ("Amy T.", 3, "Good work but communication could be faster.", "Yelp"),
                    ("Luis G.", 4, "Happy with the results overall.", "Google")]
    for a, r, t, s in demo_reviews:
        await db.reviews.insert_one({"id": f"rev_{uuid.uuid4().hex[:10]}", "business_id": business_id,
                                     "author": a, "rating": r, "text": t, "source": s,
                                     "response": "", "response_status": "none", "created_at": now_iso()})


# ===================== APP WIRING =====================
app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
async def root():
    return {"service": "Venturelyx API", "status": "ok"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.businesses.create_index("owner_id")
    await db.leads.create_index("business_id")
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    logger.info("Venturelyx API ready.")


@app.on_event("shutdown")
async def shutdown():
    from db import client
    client.close()
