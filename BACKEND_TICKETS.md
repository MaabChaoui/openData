---
Ticket 1 — Run history list endpoint

  Context: The calculation_run table already holds the full history. The frontend history tab currently only shows the
  single latest run because there is no list endpoint. The dashboard summary only returns one run_id per domain.

  What to add: One new route in app.py:

  GET /api/v1/{domain}/runs

  Query parameters:
  - limit (int, default 20, max 100)
  - offset (int, default 0)
  - status (optional string — filter to succeeded, failed, etc.)

  Response: array of run objects, same shape as GET /api/v1/{domain}/runs/{run_id} already returns, ordered by
  started_at DESC.

  Service function to add in services.py — query the calculation_run table like this:

  def list_runs(
      settings: BackendSettings,
      domain: str,
      limit: int = 20,
      offset: int = 0,
      status: str | None = None,
  ) -> list[dict[str, Any]]:
      with connect(settings.db_path) as conn:
          where = "WHERE domain = ?"
          params: list[Any] = [domain]
          if status:
              where += " AND status = ?"
              params.append(status)
          rows = conn.execute(
              f"SELECT * FROM calculation_run {where} ORDER BY started_at DESC LIMIT ? OFFSET ?",
              [*params, limit, offset],
          ).fetchall()
      return [_format_run(settings, domain, dict(r)) for r in rows]

  Where _format_run is the same serialization already used by get_run() (artifacts URLs, parameters deserialization,
  etc.). Extract the shared formatting logic into a private helper if it isn't already.

  Wire it up in app.py:

  @app.get("/api/v1/{domain}/runs")
  async def domain_list_runs(
      domain: str,
      request: Request,
      limit: int = Query(default=20, ge=1, le=100),
      offset: int = Query(default=0, ge=0),
      status: str | None = Query(default=None),
      _: dict[str, Any] = Depends(_current_session),
  ) -> list[dict[str, Any]]:
      try:
          return list_runs(_get_settings(request), domain, limit=limit, offset=offset, status=status)
      except BackendError as exc:
          raise _to_http_error(exc) from exc

  No schema changes needed — all the data is already in calculation_run.

  ---
  Ticket 2 — IBNR method comparison exposure

  Context: src/provisions/ibnr_comparison.py already computes a MethodComparisonSummary with 5 methods side by side
  (Chain Ladder, Mack, Bornhuetter-Ferguson, Benktander, Bootstrap). This is not currently returned to the frontend. The
   IBNR run result only surfaces the Chain Ladder total.

  What to add: When an IBNR run completes, serialize the full MethodComparisonSummary into the run's result.json
  artifact under a top-level key method_comparison. The total_ibnr key used by the existing extractHeadlineTotal()
  frontend logic must stay at the root so nothing breaks.

  Expected shape of result.json for IBNR runs after this change:

  {
    "total_ibnr": 12340000.00,
    "method_comparison": {
      "chain_ladder_total": 12340000.00,
      "method_range": 450000.00,
      "comparison_rows": [
        {
          "method": "chain_ladder",
          "total_ibnr": 12340000.00,
          "difference_vs_chain_ladder": 0.0,
          "pct_difference_vs_chain_ladder": 0.0,
          "se_or_p95": null
        },
        {
          "method": "mack_chain_ladder",
          "total_ibnr": 12560000.00,
          "difference_vs_chain_ladder": 220000.00,
          "pct_difference_vs_chain_ladder": 1.78,
          "se_or_p95": 310000.00
        },
        {
          "method": "bornhuetter_ferguson",
          "total_ibnr": 12100000.00,
          "difference_vs_chain_ladder": -240000.00,
          "pct_difference_vs_chain_ladder": -1.94,
          "se_or_p95": null
        },
        {
          "method": "benktander_k2",
          "total_ibnr": 12200000.00,
          "difference_vs_chain_ladder": -140000.00,
          "pct_difference_vs_chain_ladder": -1.13,
          "se_or_p95": null
        },
        {
          "method": "bootstrap_p95",
          "total_ibnr": 12790000.00,
          "difference_vs_chain_ladder": 450000.00,
          "pct_difference_vs_chain_ladder": 3.65,
          "se_or_p95": 12790000.00
        }
      ]
    }
  }

  Where to make the change: In services.py, inside create_run(), in the IBNR branch — after build_method_comparison() is
   called, serialize the result to dataclasses.asdict() and nest it under method_comparison before writing result.json.
  The total_ibnr key at the root must be ibnr_result.total_ibnr (Chain Ladder), unchanged.                          
                                                                                                                  
  No new endpoint needed. The existing GET /api/v1/ibnr/runs/{run_id}/artifacts/result.json already serves this file.   
  The frontend will read method_comparison.comparison_rows from the existing artifact.
                                                                                                                    
  ---                                                                                                             
  Priority
      
  Do Ticket 1 first — it's a straightforward read query with no risk. Ticket 2 only touches the IBNR run serialization
  path and has no breaking surface if total_ibnr stays at the root.
---
