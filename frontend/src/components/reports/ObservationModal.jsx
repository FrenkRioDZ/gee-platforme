import { useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import { Cancel } from '@mui/icons-material';
import Modal from '../ui/Modal';

export default function ObservationModal({ open, onClose, onConfirm, projectName, loading }) {
  const [observation, setObservation] = useState('');
  const [error,       setError]       = useState('');

  const handleConfirm = () => {
    if (!observation.trim()) {
      setError('Une observation est obligatoire pour rejeter un rapport.');
      return;
    }
    onConfirm(observation);
    setObservation('');
    setError('');
  };

  const handleClose = () => {
    setObservation('');
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Rejeter le rapport" maxWidth={500}>
      <Box sx={{
        p: 2, mb: 2, borderRadius: 2,
        background: 'rgba(198,40,40,0.05)',
        border: '1px solid rgba(198,40,40,0.15)'
      }}>
        <Typography fontSize="0.875rem" color="text.secondary">
          Projet : <strong>{projectName}</strong>
        </Typography>
      </Box>

      <Typography fontSize="0.875rem" color="text.secondary" mb={2}>
        Veuillez décrire clairement le problème constaté. Le bureau devra corriger et resoumettre le rapport.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        fullWidth multiline rows={4}
        label="Observation *"
        placeholder="Ex: Les taux d'avancement sont incohérents avec le rapport précédent..."
        value={observation}
        onChange={e => { setObservation(e.target.value); setError(''); }}
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={handleClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained" color="error"
          startIcon={<Cancel />}
          onClick={handleConfirm}
          disabled={loading || !observation.trim()}
        >
          {loading ? 'Rejet en cours...' : 'Confirmer le rejet'}
        </Button>
      </Box>
    </Modal>
  );
}
