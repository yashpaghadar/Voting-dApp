import React from 'react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Colors
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Colors
);

const VotingResultsChart = ({ proposals }) => {
  // Filter out removed proposals and sort by vote count (descending)
  const validProposals = proposals
    .filter(p => !p.removed && p.description && p.votes !== undefined)
    .sort((a, b) => b.votes - a.votes);

  // Get top 10 proposals if there are many
  const topProposals = validProposals.slice(0, 10);

  const data = {
    labels: topProposals.map(p => 
      p.description.length > 30 
        ? `${p.description.substring(0, 30)}...` 
        : p.description
    ),
    datasets: [
      {
        label: 'Votes',
        data: topProposals.map(p => Number(p.votes)),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Voting Results by Proposal',
        font: {
          size: 16,
          weight: 'bold',
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.raw;
            return `${label}: ${value} vote${value !== 1 ? 's' : ''}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Votes',
        },
        ticks: {
          stepSize: 1,
          precision: 0
        }
      },
      x: {
        ticks: {
          autoSkip: false,
        }
      }
    }
  };

  if (validProposals.length === 0) {
    return (
      <div className="chart-container" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>No voting data available</p>
      </div>
    );
  }


  // Calculate dynamic height based on number of proposals
  const calculateChartHeight = () => {
    const baseHeight = 400; // Base height in pixels
    const perItemHeight = 30; // Additional height per proposal
    const maxHeight = 800; // Maximum height to prevent the chart from becoming too tall
    const calculatedHeight = Math.min(
      baseHeight + (topProposals.length * perItemHeight),
      maxHeight
    );
    return `${calculatedHeight}px`;
  };

  const chartHeight = calculateChartHeight();

  return (
    <div className="chart-container" style={{ height: chartHeight, position: 'relative' }}>
      <Bar data={data} options={options} />
      {topProposals.length < validProposals.length && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
          Showing top {topProposals.length} of {validProposals.length} proposals
        </div>
      )}
    </div>
  );
};

export default VotingResultsChart;
