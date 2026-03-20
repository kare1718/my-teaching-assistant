import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

export default function Notices() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api('/students/my-notices').then(setNotices).catch(console.error);
  }, []);

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>안내사항</span>
      </div>

      <div className="card">
        <h2>안내사항</h2>
        {notices.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>안내사항이 없습니다.</p>
        ) : (
          notices.map((n) => (
            <div key={n.id} className="notice-card">
              <div className="notice-title">{n.title}</div>
              <div className="notice-date">{n.created_at}</div>
              <div className="notice-content">{n.content}</div>
            </div>
          ))
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
