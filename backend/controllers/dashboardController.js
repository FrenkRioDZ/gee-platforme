const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');
const Bureau = require('../models/Bureau');
const Project = require('../models/Project');
const User = require('../models/User');
const { getWeekLabel, getWeekDeadline } = require('../utils/scheduler');
const { exportWeeklyReports } = require('../utils/excelExport');


const getReportValue = (report, key) =>
  report.values?.get ? report.values.get(key) : report.values?.[key];

// ─── GEE DASHBOARD ─────────────────────────────────────────────
const geeDashboard = async (req, res) => {
  try {
    const deadline = req.query.weekEnd ? getWeekDeadline(new Date(req.query.weekEnd)) : getWeekDeadline();

    const bureaus = await Bureau.find({ isActive: true }).sort({ name: 1 });

    const reports = await WeeklyReport.find({ weekEnd: deadline })
      .populate('project', 'name type siteLocation entrepriseRealisation dateODS delaisContractuel specs')
      .populate('bureau', 'name')
      .populate('submittedBy', 'firstName lastName')
      .populate('bureauApprovedBy', 'firstName lastName');

    // Build bureau status grid
    const bureauGrid = bureaus.map(bureau => {
      const bureauReports = reports.filter(
        r => r.bureau._id.toString() === bureau._id.toString()
      );

      const total = bureauReports.length;
      const accepted = bureauReports.filter(r => r.status === 'accepted').length;
      const rejected = bureauReports.filter(r => r.status === 'rejected').length;
      const pending = bureauReports.filter(r =>
        ['submitted', 'bureau_reviewed', 'gee_reviewing'].includes(r.status)
      ).length;
      const late = bureauReports.filter(r => r.isLate).length;
      const draft = bureauReports.filter(r => r.status === 'draft').length;

      let overallStatus = 'non_soumis';
      if (total > 0) {
        if (late > 0) overallStatus = 'retard';
        else if (rejected > 0) overallStatus = 'rejete';
        else if (accepted === total && total > 0) overallStatus = 'accepte';
        else if (pending > 0) overallStatus = 'en_attente';
        else if (draft > 0) overallStatus = 'brouillon';
      }

      return {
        bureau: { _id: bureau._id, name: bureau.name },
        weekEnd: deadline,
        overallStatus,
        stats: { total, accepted, rejected, pending, late, draft },
        reports: bureauReports
      };
    });

    // Consolidated stats across all bureaus
    const totalReports = reports.length;
    const totalAccepted = reports.filter(r => r.status === 'accepted').length;
    const totalRejected = reports.filter(r => r.status === 'rejected').length;
    const totalLate = reports.filter(r => r.isLate).length;
    const totalPending = reports.filter(r =>
      ['submitted', 'bureau_reviewed'].includes(r.status)
    ).length;

    // Average financial consumption across all accepted reports
    const acceptedReports = reports.filter(r =>
      r.status === 'accepted' && getReportValue(r, 'tauxConsommationFinanciere') != null
    );
    const avgFinancialConsumption = acceptedReports.length
      ? (acceptedReports.reduce((sum, r) => sum + Number(getReportValue(r, 'tauxConsommationFinanciere')), 0) / acceptedReports.length).toFixed(2)
      : null;

    // Total invoicing
    const sumValue = (key) => reports.reduce((sum, r) => sum + (Number(getReportValue(r, key)) || 0), 0);
    const totalFacturationEntreprise = sumValue('entreprise_facturation');
    const totalEncaissementEntreprise = sumValue('entreprise_encaissement');
    const totalFacturationBET = sumValue('bet_facturation');
    const totalEncaissementBET = sumValue('bet_encaissement');
    const getSpec = (project, key) =>
      project?.specs?.get ? project.specs.get(key) : project?.specs?.[key];
    const totalAvanceAccordee = reports.reduce((sum, r) => {
      const a = Number(getSpec(r.project, 'avance_forfaitaire'));
      return sum + (Number.isNaN(a) ? 0 : a);
    }, 0);
    const totalAvanceRemboursee = sumValue('avance_remboursement_cumule');
    const totalAvanceSolde = totalAvanceAccordee - totalAvanceRemboursee;

    res.json({
      weekEnd: deadline,
      deadline,
      bureauGrid,
      consolidatedStats: {
        totalReports,
        totalAccepted,
        totalRejected,
        totalLate,
        totalPending,
        submissionRate: totalReports > 0
          ? `${Math.round((totalAccepted / totalReports) * 100)}%`
          : '0%',
        avgFinancialConsumption,
        totalFacturationEntreprise,
        totalEncaissementEntreprise,
        totalFacturationBET,
        totalEncaissementBET,
        totalAvanceAccordee,
        totalAvanceRemboursee,
        totalAvanceSolde
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── BUREAU DASHBOARD ──────────────────────────────────────────
const bureauDashboard = async (req, res) => {
  try {
    const deadline = req.query.weekEnd ? getWeekDeadline(new Date(req.query.weekEnd)) : getWeekDeadline();
    const bureauId = req.user.bureau._id;

    const projects = await Project.find({ bureau: bureauId, hasWeeklyReport: true, isActive: true });

    const reports = await WeeklyReport.find({ bureau: bureauId, weekEnd: deadline })
      .populate('project', 'name type siteLocation')
      .populate('submittedBy', 'firstName lastName')
      .populate('rejectionHistory.from', 'firstName lastName');

    const projectStatus = projects.map(project => {
      const report = reports.find(r => r.project._id.toString() === project._id.toString());
      return {
        project: { _id: project._id, name: project.name, type: project.type, siteLocation: project.siteLocation },
        report: report || null,
        weekLabel: getWeekLabel(project.dateODS, deadline),
        status: report ? report.status : 'non_soumis',
        isLate: report ? report.isLate : false
      };
    });

    const submitted = reports.filter(r => r.status !== 'draft').length;
    const accepted = reports.filter(r => r.status === 'accepted').length;
    const rejected = reports.filter(r => r.status === 'rejected').length;
    const late = reports.filter(r => r.isLate).length;

    res.json({
      weekEnd: deadline,
      bureau: req.user.bureau,
      projectStatus,
      stats: { totalProjects: projects.length, submitted, accepted, rejected, late, pending: projects.length - submitted - late }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── EXPORT WEEKLY REPORTS TO EXCEL ───────────────────────────
const exportWeekly = async (req, res) => {
  try {
    const deadline = req.query.weekEnd ? getWeekDeadline(new Date(req.query.weekEnd)) : getWeekDeadline();
    let filter = { weekEnd: deadline };
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    if (req.user.role.startsWith('bureau_')) {
      filter.bureau = req.user.bureau._id;
    }
    const reports = await WeeklyReport.find(filter)
      .populate('project', 'name type siteLocation entrepriseRealisation dateODS delaisContractuel')
      .populate('bureau', 'name')
      .populate('submittedBy', 'firstName lastName')
      .populate('canvasVersion');

    const label = deadline.toISOString().split('T')[0];
    const workbook = await exportWeeklyReports(reports, label);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rapport_hebdomadaire_${label}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── WEEKLY HISTORY (past weeks) ──────────────────────────────
const weeklyHistory = async (req, res) => {
  try {
    const limit = Math.min(52, Math.max(1, parseInt(req.query.limit) || 10));
    let filter = {};
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    if (req.user.role.startsWith('bureau_')) filter.bureau = req.user.bureau._id;
    const weekEnds = await WeeklyReport.distinct('weekEnd', filter);
    weekEnds.sort((a, b) => new Date(b) - new Date(a));
    const paginatedWeeks = weekEnds.slice(0, limit);

    const history = await Promise.all(paginatedWeeks.map(async (weekEnd) => {
      const reports = await WeeklyReport.find({ ...filter, weekEnd })
        .select('status isLate bureau')
        .populate('bureau', 'name');
      return {
        weekEnd,
        total: reports.length,
        accepted: reports.filter(r => r.status === 'accepted').length,
        rejected: reports.filter(r => r.status === 'rejected').length,
        late: reports.filter(r => r.isLate).length,
        pending: reports.filter(r => ['submitted', 'bureau_approved'].includes(r.status)).length
      };
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GRAPH DATA ────────────────────────────────────────────────
const graphData = async (req, res) => {
  try {
    const weeksCount = Math.min(52, Math.max(1, parseInt(req.query.weeks) || 8));
    let filter = {};
    if (req.query.bureau && mongoose.Types.ObjectId.isValid(String(req.query.bureau))) {
      filter.bureau = new mongoose.Types.ObjectId(String(req.query.bureau));
    }
    if (req.user.role.startsWith('bureau_')) {
      filter.bureau = req.user.bureau._id;
    }
    const weekEndsAll = await WeeklyReport.distinct('weekEnd', filter);
    weekEndsAll.sort((a, b) => new Date(b) - new Date(a));
    const selectedWeeks = weekEndsAll.slice(0, weeksCount).reverse();

    const reports = await WeeklyReport.find({
      ...filter,
      weekEnd: { $in: selectedWeeks },
      status: 'accepted'
    })
      .populate('project', 'name siteLocation dateODS delaisContractuel')
      .populate('bureau', 'name');

    const projectMap = {};
    reports.forEach(r => {
      const pid = r.project?._id?.toString();
      if (!pid) return;
      if (!projectMap[pid]) {
        projectMap[pid] = { projectName: r.project.name, site: r.project.siteLocation, dateODS: r.project.dateODS, delaisContractuel: r.project.delaisContractuel, data: {} };
      }
      projectMap[pid].data[r.weekEnd.toISOString()] = {
        weekLabel: r.weekLabel,
        tauxAvancement: getReportValue(r, 'tauxAvancementGlobal'),
        tauxFinancier: getReportValue(r, 'tauxConsommationFinanciere'),
        tauxDelais: getReportValue(r, 'tauxConsommationDelais'),
      };
    });

    const weekKeys = selectedWeeks.map(d => new Date(d).toISOString());
    const progressSeries = Object.values(projectMap).map(proj => ({
      projectName: proj.projectName,
      site: proj.site,
      weeks: weekKeys,
      avancement: weekKeys.map(w => proj.data[w]?.tauxAvancement ?? null),
      financier: weekKeys.map(w => proj.data[w]?.tauxFinancier ?? null),
      delais: weekKeys.map(w => proj.data[w]?.tauxDelais ?? null),
    }));

    // Deadline countdown — all active projects with weekly reports
    const projects = await Project.find({
      ...(filter.bureau ? { bureau: filter.bureau } : {}),
      hasWeeklyReport: true,
      isActive: true
    }).populate('bureau', 'name');

    const now = new Date();
    const deadlines = projects.map(p => {
      const endDate = new Date(p.dateODS);
      endDate.setMonth(endDate.getMonth() + p.delaisContractuel);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      return {
        projectName: p.name,
        bureau: p.bureau?.name,
        site: p.siteLocation,
        endDate,
        daysLeft,
        status: daysLeft < 0 ? 'overdue' : daysLeft <= 30 ? 'critical' : daysLeft <= 90 ? 'warning' : 'ok'
      };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    // Weekly submission rate for bar chart
    const weeklyStats = await Promise.all(selectedWeeks.map(async weekEnd => {
      const allReports = await WeeklyReport.find({ ...filter, weekEnd });
      return {
        weekEnd,
        accepted: allReports.filter(r => r.status === 'accepted').length,
        rejected: allReports.filter(r => r.status === 'rejected').length,
        pending: allReports.filter(r => ['submitted', 'bureau_approved'].includes(r.status)).length,
        late: allReports.filter(r => r.isLate).length,
      };
    }));

    res.json({ progressSeries, deadlines, weeklyStats, weeks: selectedWeeks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { geeDashboard, bureauDashboard, exportWeekly, weeklyHistory, graphData };
