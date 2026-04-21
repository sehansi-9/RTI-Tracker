import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Templates } from './pages/Templates';
import { Receivers } from './pages/Receivers';
import { CreateRTI } from './pages/CreateRTI';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="templates" element={<Templates />} />
          <Route path="receivers" element={<Receivers />} />
          <Route path="create" element={<CreateRTI />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}