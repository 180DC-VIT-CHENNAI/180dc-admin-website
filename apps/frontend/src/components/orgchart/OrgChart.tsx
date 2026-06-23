// OrgChart.tsx
import React, { useState } from 'react';
import { facultyAdvisor, orgChartTree } from './orgChartData';
import type { OrgChartPerson } from './orgChartData';
import './OrgChart.css';

type Variant = 'advisor' | 'president' | 'vp' | 'left' | 'right';

function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 60 60" className="orgchart-placeholder-icon" aria-hidden="true">
      <circle cx="30" cy="23" r="10" fill="#C9C3AE" />
      <path d="M14,49 C14,32 46,32 46,49 Z" fill="#C9C3AE" />
    </svg>
  );
}

function PersonCard({ person, variant }: { person: OrgChartPerson; variant: Variant }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = person.photo && !photoFailed;

  return (
    <div className={`orgchart-card orgchart-card--${variant}`}>
      <div className="orgchart-avatar">
        {showPhoto ? (
          <img
            src={person.photo}
            alt={person.name}
            className="orgchart-avatar-img"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <PlaceholderIcon />
        )}
      </div>
      <p className="orgchart-name">{person.name}</p>
      <p className="orgchart-role">{person.role}</p>
    </div>
  );
}

export default function OrgChart() {
  const [vpLeft, vpRight] = orgChartTree.children ?? [];

  return (
    <div className="orgchart-outer-container">
      <div className="orgchart-wrapper">
        <div className="orgchart-scroll">
          <div className="orgchart-tree-canvas">
            
            {/* Top Row Header Layout */}
            <div className="orgchart-top-header-row">
              <div className="orgchart-advisor-cell">
                <PersonCard person={facultyAdvisor} variant="advisor" />
              </div>
              
              <div className="orgchart-president-cell">
                <PersonCard person={orgChartTree} variant="president" />
                <div className="orgchart-president-drop-line" />
              </div>
            </div>

            {/* Tree Branch Matrix */}
            <ul className="orgchart-tree line-trunk">
              
              {/* LEFT VP BRANCH */}
              <li className="orgchart-node-item">
                <PersonCard person={vpLeft} variant="vp" />
                <ul className="orgchart-tree line-branch-left">
                  {vpLeft?.children?.map((dept, i) => (
                    <li key={i} className="orgchart-node-item">
                      <PersonCard person={dept} variant="left" />
                      {dept.children && dept.children.length > 0 && (
                        <ul className="orgchart-tree sub-branch">
                          {dept.children.map((report, j) => (
                            <li key={j} className="orgchart-node-item">
                              <PersonCard person={report} variant="left" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>

              {/* RIGHT VP BRANCH */}
              <li className="orgchart-node-item">
                <PersonCard person={vpRight} variant="vp" />
                <ul className="orgchart-tree line-branch-right">
                  {vpRight?.children?.map((dept, i) => (
                    <li key={i} className="orgchart-node-item">
                      <PersonCard person={dept} variant="right" />
                      {dept.children && dept.children.length > 0 && (
                        <ul className="orgchart-tree sub-branch">
                          {dept.children.map((report, j) => (
                            <li key={j} className="orgchart-node-item">
                              <PersonCard person={report} variant="right" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>

            </ul>

          </div>
        </div>
      </div>
    </div>
  );
}