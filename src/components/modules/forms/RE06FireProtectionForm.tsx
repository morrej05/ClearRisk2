import { useState, useEffect } from 'react';

export default function RE06FireProtectionForm() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(1);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>RE06 is compiling</h2>
      <p>Hooks working. Count = {count}</p>
    </div>
  );
}
