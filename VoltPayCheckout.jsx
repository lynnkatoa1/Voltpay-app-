import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function VoltPayCheckout({ amountUsd, merchantAddress, orderId, onSettled }) {
  const [rail, setRail] = useState('lightning'); // 'lightning' | 'evm' | 'solana'
  const [invoice, setInvoice] = useState(null);
  const [isSettled, setIsSettled] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. Lightning Invoice Workflow
  const requestLightning = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/lightning/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd, orderId, memo: 'Order Checkout' }),
      });
      const data = await res.json();
      setInvoice(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll for Lightning Payment Status
  useEffect(() => {
    if (!invoice?.rHash || isSettled) return;
    const poll = setInterval(async () => {
      const res = await fetch(`http://localhost:5000/api/lightning/invoice/${invoice.rHash}`);
      const data = await res.json();
      if (data.settled) {
        setIsSettled(true);
        clearInterval(poll);
        if (onSettled) onSettled();
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [invoice, isSettled]);

  // 2. EVM Native / Token Workflow (Base, Arbitrum, Polygon)
  const handleEVMPay = async () => {
    if (!window.ethereum) return alert('Please install MetaMask or an EVM wallet.');
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      // Call VoltPayRouter contract via standard eth_sendTransaction or ethers/viem
      alert(`Routing EVM transaction from ${accounts[0].slice(0, 6)}... to VoltPayRouter. Slicing $0.30 to treasury.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Solana Workflow
  const handleSolanaPay = async () => {
    if (!window.solana) return alert('Please install Phantom or a Solana wallet.');
    try {
      setLoading(true);
      const resp = await window.solana.connect();
      const res = await fetch('http://localhost:5000/api/solana/build-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerPubkey: resp.publicKey.toString(),
          merchantPubkey: merchantAddress,
          amountUsd,
        }),
      });
      const { transaction } = await res.json();
      alert(`Constructed atomic transaction. Phantom will sign transfer splitting $0.30 fee to treasury.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>⚡ VoltPay Protocol</h2>
        <span style={styles.tag}>Multi-Chain Routing</span>
      </div>

      <div style={styles.summary}>
        <p style={{ margin: '0.25rem 0', color: '#94a3b8' }}>Total Settlement (Order #{orderId})</p>
        <h1 style={{ margin: '0.25rem 0' }}>${(parseFloat(amountUsd) + 0.30).toFixed(2)}</h1>
        <small style={{ color: '#10b981' }}>Includes flat $0.30 network protocol fee</small>
      </div>

      {/* Rail Tabs */}
      <div style={styles.tabContainer}>
        {['lightning', 'evm', 'solana'].map((t) => (
          <button
            key={t}
            onClick={() => { setRail(t); setInvoice(null); }}
            style={{ ...styles.tabBtn, borderBottom: rail === t ? '2px solid #f59e0b' : 'none' }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Action Body */}
      {isSettled ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: '#10b981' }}>
          <h3>✓ Payment Verified On-Chain!</h3>
          <p>30¢ platform surcharge routed to treasury.</p>
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          {rail === 'lightning' && (
            <div>
              {!invoice ? (
                <button style={styles.cta} onClick={requestLightning} disabled={loading}>
                  {loading ? 'Generating...' : 'Pay with Lightning'}
                </button>
              ) : (
                <div>
                  <div style={{ background: '#fff', padding: '1rem', display: 'inline-block', borderRadius: '8px' }}>
                    <QRCodeSVG value={invoice.paymentRequest} size={180} />
                  </div>
                  <p style={{ fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace', color: '#94a3b8' }}>
                    {invoice.paymentRequest}
                  </p>
                </div>
              )}
            </div>
          )}

          {rail === 'evm' && (
            <button style={styles.cta} onClick={handleEVMPay} disabled={loading}>
              Pay via Base / Arbitrum / Polygon
            </button>
          )}

          {rail === 'solana' && (
            <button style={styles.cta} onClick={handleSolanaPay} disabled={loading}>
              Pay via Phantom (Solana)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: '#0f172a', color: '#f8fafc', padding: '1.5rem', borderRadius: '16px', maxWidth: '440px', margin: '2rem auto', border: '1px solid #1e293b', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  tag: { background: '#1e293b', fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '6px', color: '#f59e0b', fontWeight: 600 },
  summary: { background: '#1e293b', padding: '1rem', borderRadius: '10px', textAlign: 'center' },
  tabContainer: { display: 'flex', justifyContent: 'space-around', marginTop: '1rem', borderBottom: '1px solid #334155' },
  tabBtn: { background: 'none', border: 'none', color: '#f8fafc', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 },
  cta: { background: '#f59e0b', border: 'none', borderRadius: '8px', padding: '0.8rem 1.5rem', color: '#000', fontWeight: 700, width: '100%', cursor: 'pointer' },
};
