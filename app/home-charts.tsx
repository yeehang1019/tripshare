'use client';
import type {ReactNode} from 'react';
export default function HomeCharts({owner,category,daily,categoryBars,upfront}:{owner:boolean;category:ReactNode;daily:ReactNode;categoryBars:ReactNode;upfront:()=>ReactNode}){
 return <section className="dashboard-charts"><div className="panel"><h2>Spending by category</h2>{category}</div><div className="panel"><h2>Daily spending</h2>{daily}</div>{owner?<div className="panel"><div className="section-title"><h2>Who paid upfront</h2><span className="pill">OWNER VIEW</span></div>{upfront()}</div>:<div className="panel"><h2>Spending by category</h2>{categoryBars}</div>}</section>;
}
