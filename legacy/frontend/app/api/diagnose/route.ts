import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, ress:NextResponse) {

    let body = await req.json()
    let getData = await fetch("http://127.0.0.1:5000/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          watch_metrics: body.watch_metrics,
          symptoms: { symptoms: body.symptoms },
        }),
      }).then((res) => res.json());

    return NextResponse.json(getData)
}