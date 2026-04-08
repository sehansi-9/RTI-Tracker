import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus} from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { SearchableSelect } from '../components/SearchableSelect';
import { DataTable} from '../components/DataTable';
import { receiversService } from '../services/receiversService';
import { Institution, Position, Receiver } from '../types/db';

type TabKey = 'receivers' | 'institutions' | 'positions';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium rounded border transition-colors ${
        active
          ? 'bg-blue-50 text-blue-900 border-blue-200 border-l-4 border-l-blue-900'
          : 'text-gray-700 border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export function Receivers() {
  const [tab, setTab] = useState<TabKey>('receivers');

  // Receivers
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [receiversLoading, setReceiversLoading] = useState(true);
  const [receiversPagination, setReceiversPagination] = useState({ page: 1, totalPages: 1 });
  const [receiverDeleteId, setReceiverDeleteId] = useState<string | null>(null);
  const [receiverEdit, setReceiverEdit] = useState<Receiver | null>(null);
  const [receiverModalOpen, setReceiverModalOpen] = useState(false);
  const [receiverForm, setReceiverForm] = useState({
    institutionId: '',
    positionId: '',
    email: '',
    contactNo: '',
    address: ''
  });

  // Institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsPagination, setInstitutionsPagination] = useState({ page: 1, totalPages: 1 });
  const [institutionDeleteId, setInstitutionDeleteId] = useState<string | null>(null);
  const [institutionEdit, setInstitutionEdit] = useState<Institution | null>(null);
  const [institutionModalOpen, setInstitutionModalOpen] = useState(false);
  const [institutionName, setInstitutionName] = useState('');

  // Positions
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsPagination, setPositionsPagination] = useState({ page: 1, totalPages: 1 });
  const [positionDeleteId, setPositionDeleteId] = useState<string | null>(null);
  const [positionEdit, setPositionEdit] = useState<Position | null>(null);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [positionName, setPositionName] = useState('');

  // Redirection
  const [isRedirecting, setIsRedirecting] = useState<'institution' | 'position' | null>(null);

  const startInstitutionRedirect = (name: string) => {
    setIsRedirecting('institution');
    setInstitutionName(name);
    setInstitutionEdit(null);
    setInstitutionModalOpen(true);
    setReceiverModalOpen(false);
    setTab('institutions');
  };

  const startPositionRedirect = (name: string) => {
    setIsRedirecting('position');
    setPositionName(name);
    setPositionEdit(null);
    setPositionModalOpen(true);
    setReceiverModalOpen(false);
    setTab('positions');
  };

  const loadReceivers = async (page = 1) => {
    setReceiversLoading(true);
    try {
      const res = await receiversService.listReceivers(page, 10);
      setReceivers(res.data);
      setReceiversPagination(res.pagination);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to load receivers');
    } finally {
      setReceiversLoading(false);
    }
  };

  const loadInstitutions = async (page = 1) => {
    setInstitutionsLoading(true);
    try {
      const res = await receiversService.listInstitutions(page, 10);
      setInstitutions(res.data);
      setInstitutionsPagination(res.pagination);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to load institutions');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  const loadPositions = async (page = 1) => {
    setPositionsLoading(true);
    try {
      const res = await receiversService.listPositions(page, 10);
      setPositions(res.data);
      setPositionsPagination(res.pagination);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to load positions');
    } finally {
      setPositionsLoading(false);
    }
  };

  useEffect(() => {
    loadReceivers(1);
    loadInstitutions(1);
    loadPositions(1);
  }, []);

  const receiverModalTitle = useMemo(() => (receiverEdit ? 'Edit Receiver' : 'New Receiver'), [receiverEdit]);

  const openReceiverCreate = () => {
    setReceiverEdit(null);
    setReceiverForm({ institutionId: '', positionId: '', email: '', contactNo: '', address: '' });
    setReceiverModalOpen(true);
  };

  const openReceiverEdit = (r: Receiver) => {
    setReceiverEdit(r);
    setReceiverForm({
      institutionId: r.institutionId,
      positionId: r.positionId,
      email: r.email ?? '',
      contactNo: r.contactNo ?? '',
      address: r.address ?? ''
    });
    setReceiverModalOpen(true);
  };

  const saveReceiver = async () => {
    const payload = {
      institutionId: receiverForm.institutionId,
      positionId: receiverForm.positionId,
      email: receiverForm.email.trim() || null,
      contactNo: receiverForm.contactNo.trim() || null,
      address: receiverForm.address.trim() || null
    };

    if (!payload.institutionId) return toast.error('Institution is required');
    if (!payload.positionId) return toast.error('Position is required');
    if (!payload.email && !payload.contactNo) return toast.error('Email or Contact No is required');

    try {
      if (receiverEdit) {
        await receiversService.updateReceiver(receiverEdit.id, payload);
        toast.success('Receiver updated');
      } else {
        await receiversService.createReceiver(payload);
        toast.success('Receiver created');
      }
      setReceiverModalOpen(false);
      setReceiverEdit(null);
      await loadReceivers(receiversPagination.page);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save receiver');
    }
  };

  const confirmReceiverDelete = async () => {
    if (!receiverDeleteId) return;
    const id = receiverDeleteId;
    setReceiverDeleteId(null);
    try {
      await receiversService.removeReceiver(id);
      toast.success('Receiver deleted');
      const pageToFetch =
        receivers.length === 1 && receiversPagination.page > 1 ? receiversPagination.page - 1 : receiversPagination.page;
      await loadReceivers(pageToFetch);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete receiver');
    }
  };

  const institutionModalTitle = useMemo(() => (institutionEdit ? 'Edit Institution' : 'New Institution'), [institutionEdit]);

  const openInstitutionCreate = () => {
    setInstitutionEdit(null);
    setInstitutionName('');
    setInstitutionModalOpen(true);
  };

  const openInstitutionEdit = (i: Institution) => {
    setInstitutionEdit(i);
    setInstitutionName(i.name);
    setInstitutionModalOpen(true);
  };

  const saveInstitution = async () => {
    const trimmed = institutionName.trim();
    if (!trimmed) return toast.error('Name is required');
    try {
      if (institutionEdit) {
        await receiversService.updateInstitution(institutionEdit.id, { name: trimmed });
        toast.success('Institution updated');
      } else {
        const res = await receiversService.createInstitution({ name: trimmed });
        toast.success('Institution created');
        if (isRedirecting === 'institution') {
          setReceiverForm((s) => ({ ...s, institutionId: res.id }));
          setTab('receivers');
          setReceiverModalOpen(true);
          setIsRedirecting(null);
        }
      }
      setInstitutionModalOpen(false);
      setInstitutionEdit(null);
      await loadInstitutions(institutionsPagination.page);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save institution');
    }
  };

  const confirmInstitutionDelete = async () => {
    if (!institutionDeleteId) return;
    const id = institutionDeleteId;
    setInstitutionDeleteId(null);
    try {
      await receiversService.removeInstitution(id);
      toast.success('Institution deleted');
      const pageToFetch =
        institutions.length === 1 && institutionsPagination.page > 1 ? institutionsPagination.page - 1 : institutionsPagination.page;
      await loadInstitutions(pageToFetch);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete institution');
    }
  };

  const positionModalTitle = useMemo(() => (positionEdit ? 'Edit Position' : 'New Position'), [positionEdit]);

  const openPositionCreate = () => {
    setPositionEdit(null);
    setPositionName('');
    setPositionModalOpen(true);
  };

  const openPositionEdit = (p: Position) => {
    setPositionEdit(p);
    setPositionName(p.name);
    setPositionModalOpen(true);
  };

  const savePosition = async () => {
    const trimmed = positionName.trim();
    if (!trimmed) return toast.error('Name is required');
    try {
      if (positionEdit) {
        await receiversService.updatePosition(positionEdit.id, { name: trimmed });
        toast.success('Position updated');
      } else {
        const res = await receiversService.createPosition({ name: trimmed });
        toast.success('Position created');
        if (isRedirecting === 'position') {
          setReceiverForm((s) => ({ ...s, positionId: res.id }));
          setTab('receivers');
          setReceiverModalOpen(true);
          setIsRedirecting(null);
        }
      }
      setPositionModalOpen(false);
      setPositionEdit(null);
      await loadPositions(positionsPagination.page);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save position');
    }
  };

  const confirmPositionDelete = async () => {
    if (!positionDeleteId) return;
    const id = positionDeleteId;
    setPositionDeleteId(null);
    try {
      await receiversService.removePosition(id);
      toast.success('Position deleted');
      const pageToFetch =
        positions.length === 1 && positionsPagination.page > 1 ? positionsPagination.page - 1 : positionsPagination.page;
      await loadPositions(pageToFetch);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete position');
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="min-w-[200px]">
          <h1 className="text-2xl font-bold text-gray-900">Receivers</h1>
          <p className="text-sm text-gray-600 mt-1">Manage receivers, institutions, and positions.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'receivers'} onClick={() => setTab('receivers')}>
          Receivers
        </TabButton>
        <TabButton active={tab === 'institutions'} onClick={() => setTab('institutions')}>
          Institutions
        </TabButton>
        <TabButton active={tab === 'positions'} onClick={() => setTab('positions')}>
          Positions
        </TabButton>
      </div>

      {tab === 'receivers' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between gap-3">
            <div className="font-semibold text-xs uppercase tracking-wider text-gray-500">Receiver List</div>
            <Button onClick={openReceiverCreate} size="sm" className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> New Receiver
            </Button>
          </div>

          <DataTable
            data={receivers}
            columns={[
              { header: 'Institution', accessor: 'institutionName', className: 'font-medium text-gray-900' },
              { header: 'Position', accessor: 'positionName', className: 'text-gray-700' },
              { header: 'Email', accessor: 'email', className: 'text-gray-600' },
              { header: 'Contact No', accessor: 'contactNo', className: 'text-gray-600' },
              { header: 'Address', accessor: 'address', className: 'text-gray-600' },
            ]}
            onEdit={openReceiverEdit}
            onDelete={(r) => setReceiverDeleteId(r.id)}
            loading={receiversLoading}
            loadingMessage="Loading receivers..."
            emptyMessage="No receivers found."
            rowKey="id"
            currentPage={receiversPagination.page}
            totalPages={receiversPagination.totalPages}
            onPageChange={(p) => loadReceivers(p)}
          />
        </div>
      )}

      {tab === 'institutions' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between gap-3">
            <div className="font-semibold text-xs uppercase tracking-wider text-gray-500">Institution List</div>
            <Button onClick={openInstitutionCreate} size="sm" className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> New Institution
            </Button>
          </div>

          <DataTable
            data={institutions}
            columns={[
              { header: 'Name', accessor: 'name', className: 'font-medium text-gray-900' },
            ]}
            onEdit={openInstitutionEdit}
            onDelete={(i) => setInstitutionDeleteId(i.id)}
            loading={institutionsLoading}
            loadingMessage="Loading institutions..."
            emptyMessage="No institutions found."
            rowKey="id"
            currentPage={institutionsPagination.page}
            totalPages={institutionsPagination.totalPages}
            onPageChange={(p) => loadInstitutions(p)}
          />
        </div>
      )}

      {tab === 'positions' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between gap-3">
            <div className="font-semibold text-xs uppercase tracking-wider text-gray-500">Position List</div>
            <Button onClick={openPositionCreate} size="sm" className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> New Position
            </Button>
          </div>

          <DataTable
            data={positions}
            columns={[
              { header: 'Name', accessor: 'name', className: 'font-medium text-gray-900' },
            ]}
            onEdit={openPositionEdit}
            onDelete={(p) => setPositionDeleteId(p.id)}
            loading={positionsLoading}
            loadingMessage="Loading positions..."
            emptyMessage="No positions found."
            rowKey="id"
            currentPage={positionsPagination.page}
            totalPages={positionsPagination.totalPages}
            onPageChange={(p) => loadPositions(p)}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!receiverDeleteId}
        title="Delete Receiver?"
        message="Are you sure you want to delete this receiver? This action cannot be undone."
        onCancel={() => setReceiverDeleteId(null)}
        onConfirm={confirmReceiverDelete}
        confirmText="Delete"
      />

      <Modal
        open={receiverModalOpen}
        title={receiverModalTitle}
        onClose={() => {
          setReceiverModalOpen(false);
          setReceiverEdit(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setReceiverModalOpen(false);
                setReceiverEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveReceiver}>{receiverEdit ? 'Save Changes' : 'Create Receiver'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Institution</label>
            <SearchableSelect
              placeholder="Select institution"
              value={receiverForm.institutionId}
              onChange={(id) => setReceiverForm((s) => ({ ...s, institutionId: id }))}
              options={institutions}
              onAddSpecial={startInstitutionRedirect}
              addLabel="Add Institution"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Position</label>
            <SearchableSelect
              placeholder="Select position"
              value={receiverForm.positionId}
              onChange={(id) => setReceiverForm((s) => ({ ...s, positionId: id }))}
              options={positions}
              onAddSpecial={startPositionRedirect}
              addLabel="Add Position"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</label>
            <input
              className="px-3 py-2 rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              value={receiverForm.email}
              onChange={(e) => setReceiverForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="receiver@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact No</label>
            <input
              className="px-3 py-2 rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              value={receiverForm.contactNo}
              onChange={(e) => setReceiverForm((s) => ({ ...s, contactNo: e.target.value }))}
              placeholder="Phone number"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Address</label>
            <input
              className="px-3 py-2 rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              value={receiverForm.address}
              onChange={(e) => setReceiverForm((s) => ({ ...s, address: e.target.value }))}
              placeholder="Address (optional)"
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-gray-500">
              Note: Per database rules, at least one of <strong>Email</strong> or <strong>Contact No</strong> must be
              provided.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!institutionDeleteId}
        title="Delete Institution?"
        message="Are you sure you want to delete this institution? This action cannot be undone."
        onCancel={() => setInstitutionDeleteId(null)}
        onConfirm={confirmInstitutionDelete}
        confirmText="Delete"
      />

      <Modal
        open={institutionModalOpen}
        title={institutionModalTitle}
        onClose={() => {
          setInstitutionModalOpen(false);
          setInstitutionEdit(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setInstitutionModalOpen(false);
                setInstitutionEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveInstitution}>{institutionEdit ? 'Save Changes' : 'Create Institution'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</label>
          <input
            className="px-3 py-2 rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="Institution name"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!positionDeleteId}
        title="Delete Position?"
        message="Are you sure you want to delete this position? This action cannot be undone."
        onCancel={() => setPositionDeleteId(null)}
        onConfirm={confirmPositionDelete}
        confirmText="Delete"
      />

      <Modal
        open={positionModalOpen}
        title={positionModalTitle}
        onClose={() => {
          setPositionModalOpen(false);
          setPositionEdit(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPositionModalOpen(false);
                setPositionEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={savePosition}>{positionEdit ? 'Save Changes' : 'Create Position'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</label>
          <input
            className="px-3 py-2 rounded border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
            value={positionName}
            onChange={(e) => setPositionName(e.target.value)}
            placeholder="Position name"
          />
        </div>
      </Modal>
    </div>
  );
}