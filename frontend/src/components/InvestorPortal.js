import React, { useEffect, useState } from 'react';

export default function InvestorPortal() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch('/investor-portal/api/report')
      .then(res => res.json())
      .then(setReport)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Investor Portal</h2>
      {report ? (
        <div>
          <p>Latest Report: {report.date}</p>
          <a href={report.url}>Download PDF</a>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
