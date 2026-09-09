import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#1a237e', '#FF9933', '#138808', '#c62828', '#1565c0', '#f57f17', '#6a1b9a', '#00838f'];

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then(res => setData(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="loading-container"><div className="spinner" /></div></Layout>;
  if (!data) return <Layout><div className="empty-state"><h3>No analytics data</h3></div></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <h2>Compliance Analytics</h2>
        <p>Organization-wide trends and statistics computed from inspection data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Inspections Over Time */}
        <div className="card">
          <div className="card-header"><h3>Inspections Over Time</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data.inspectionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="inspections" stroke="#1a237e" strokeWidth={2} name="Total" />
                <Line type="monotone" dataKey="compliant" stroke="#138808" strokeWidth={2} name="Compliant" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Compliance */}
        <div className="card">
          <div className="card-header"><h3>Category Compliance</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.categoryCompliance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="inspections" fill="#1a237e" radius={[4, 4, 0, 0]} name="Inspections" />
                <Bar dataKey="compliant" fill="#138808" radius={[4, 4, 0, 0]} name="Compliant" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* District Stats */}
        <div className="card">
          <div className="card-header"><h3>District-wise Inspections</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.districtStats} dataKey="inspections" nameKey="district" cx="50%" cy="50%" outerRadius={100} label>
                  {data.districtStats?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Violation Types */}
        <div className="card">
          <div className="card-header"><h3>Top Violation Types</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.violationTypes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="rule_name" type="category" tick={{ fontSize: 10 }} width={150} />
                <Tooltip />
                <Bar dataKey="count" fill="#c62828" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inspector Activity */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header"><h3>Inspector Activity</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.inspectorActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="inspections" fill="#1a237e" radius={[4, 4, 0, 0]} name="Inspections" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
