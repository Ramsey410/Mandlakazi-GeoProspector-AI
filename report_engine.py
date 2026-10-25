"""
Professional PDF report generation for geological analysis
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
import os
from io import BytesIO
import base64

class ReportMetadata(BaseModel):
    """Report metadata"""
    title: str
    location: str
    coordinates: Tuple[float, float]
    mineral: str
    analyst: str = "Mandlakazi GeoProspector AI"
    company: str = "Mandlakazi Mining Holdings"
    date: Optional[str] = None
    
class SatelliteData(BaseModel):
    """Satellite imagery information"""
    source: str
    acquisition_date: str
    cloud_percentage: float
    resolution_m: int
    bands: List[str]

class AnalysisResults(BaseModel):
    """Analysis results summary"""
    iron_oxide: float
    clay_index: float
    hydrothermal: float
    slope: float
    prospectivity_score: float
    confidence: float

class BoreholeRecommendation(BaseModel):
    """Single borehole recommendation"""
    rank: int
    latitude: float
    longitude: float
    confidence: float
    mineral: str
    recommended_depth: int

def create_styled_document(filename: str, metadata: ReportMetadata) -> SimpleDocTemplate:
    """Create styled PDF document"""
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title=metadata.title
    )
    return doc

def create_title_page(metadata: ReportMetadata) -> List:
    """Create title page content"""
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=colors.HexColor('#1F3A70'),  # Deep blue
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#555555'),
        spaceAfter=8,
        alignment=TA_CENTER
    )
    
    metadata_style = ParagraphStyle(
        'Metadata',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#666666'),
        spaceAfter=4,
        alignment=TA_CENTER
    )

    disclaimer_style = ParagraphStyle(
        'FieldVerificationDisclaimer',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#7A1F1F'),
        backColor=colors.HexColor('#FCE8E6'),
        borderColor=colors.HexColor('#B3261E'),
        borderWidth=1,
        borderPadding=8,
        spaceBefore=12,
        spaceAfter=16,
        alignment=TA_CENTER,
    )
    
    elements = []
    
    # Title
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("MANDLAKAZI GEOPROSPECTOR AI", title_style))
    elements.append(Paragraph("Professional Mineral Prospectivity Analysis Report", subtitle_style))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        "FIELD VERIFICATION REQUIRED: Satellite-based analysis identifies areas with mineral potential "
        "and does not replace field verification.",
        disclaimer_style,
    ))
    
    # Metadata table
    metadata_date = metadata.date or datetime.now().strftime("%Y-%m-%d")
    
    metadata_table_data = [
        ['Location:', metadata.location],
        ['Latitude:', f"{metadata.coordinates[0]:.6f}"],
        ['Longitude:', f"{metadata.coordinates[1]:.6f}"],
        ['Target Mineral:', metadata.mineral.upper()],
        ['Analysis Date:', metadata_date],
        ['Company:', metadata.company],
        ['Analyst:', metadata.analyst],
    ]
    
    metadata_table = Table(metadata_table_data, colWidths=[2.0*inch, 3.5*inch])
    metadata_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E8EEF7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    
    elements.append(metadata_table)
    elements.append(Spacer(1, 0.5*inch))
    
    elements.append(Paragraph(
        "This report presents the results of automated geospatial analysis using satellite remote sensing "
        "and machine learning to identify mineral prospectivity targets.",
        styles['Normal']
    ))
    
    elements.append(PageBreak())
    
    return elements

def create_satellite_data_section(satellite: SatelliteData) -> List:
    """Create satellite data section"""
    styles = getSampleStyleSheet()
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1F3A70'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    elements.append(Paragraph("1. SATELLITE DATA SOURCE", heading_style))
    
    sat_data_table = [
        ['Data Source:', satellite.source],
        ['Acquisition Date:', satellite.acquisition_date],
        ['Cloud Coverage:', f"{satellite.cloud_percentage:.1f}%"],
        ['Ground Resolution:', f"{satellite.resolution_m}m"],
        ['Spectral Bands:', ', '.join(satellite.bands)],
    ]
    
    sat_table = Table(sat_data_table, colWidths=[2.0*inch, 3.5*inch])
    sat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E8EEF7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey)
    ]))
    
    elements.append(sat_table)
    elements.append(Spacer(1, 0.3*inch))
    
    return elements

def create_analysis_results_section(results: AnalysisResults, mineral: str) -> List:
    """Create analysis results section"""
    styles = getSampleStyleSheet()
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1F3A70'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    elements.append(Paragraph("2. SPECTRAL ANALYSIS RESULTS", heading_style))
    
    # Interpretation based on mineral
    interpretation = get_mineral_interpretation(mineral, results)
    
    elements.append(Paragraph(interpretation, styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Results table
    results_data = [
        ['Metric', 'Value', 'Interpretation'],
        ['Iron Oxide Ratio (B4/B2)', f"{results.iron_oxide:.3f}", 'Hematite/Magnetite abundance'],
        ['Clay Alteration (B11/B12)', f"{results.clay_index:.3f}", 'Phyllosilicate alteration zones'],
        ['Hydrothermal Index (B11/B8)', f"{results.hydrothermal:.3f}", 'Water-bearing mineral extent'],
        ['Slope (degrees)', f"{results.slope:.1f}", 'Terrain favorability'],
        ['Prospectivity Score', f"{results.prospectivity_score:.1%}", 'Combined index'],
        ['Confidence Level', f"{results.confidence:.1%}", 'Data quality & reliability'],
    ]
    
    results_table = Table(results_data, colWidths=[1.8*inch, 1.2*inch, 2.5*inch])
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F3A70')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F8FC')])
    ]))
    
    elements.append(results_table)
    elements.append(Spacer(1, 0.3*inch))
    
    return elements

def create_borehole_recommendations_section(boreholes: List[BoreholeRecommendation]) -> List:
    """Create borehole recommendations section"""
    styles = getSampleStyleSheet()
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1F3A70'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    elements.append(Paragraph("3. RECOMMENDED BOREHOLE TARGETS", heading_style))
    
    elements.append(Paragraph(
        "The following drilling locations are ranked by prospectivity score and geological confidence. "
        "Each target represents an optimal drilling location identified through multi-spectral analysis.",
        styles['Normal']
    ))
    elements.append(Spacer(1, 0.15*inch))
    
    # Borehole table
    borehole_data = [['Rank', 'Latitude', 'Longitude', 'Confidence', 'Recommended Depth', 'Mineral']]
    
    for bh in boreholes:
        borehole_data.append([
            str(bh.rank),
            f"{bh.latitude:.6f}",
            f"{bh.longitude:.6f}",
            f"{bh.confidence:.1%}",
            f"{bh.recommended_depth}m",
            bh.mineral.capitalize()
        ])
    
    borehole_table = Table(borehole_data, colWidths=[0.7*inch, 1.2*inch, 1.2*inch, 1.0*inch, 1.2*inch, 0.9*inch])
    borehole_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F3A70')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F8FC')])
    ]))
    
    elements.append(borehole_table)
    elements.append(Spacer(1, 0.3*inch))
    
    return elements

def create_geological_interpretation_section(mineral: str, results: AnalysisResults) -> List:
    """Create geological interpretation section"""
    styles = getSampleStyleSheet()
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1F3A70'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    elements.append(Paragraph("4. GEOLOGICAL INTERPRETATION", heading_style))
    
    interpretation_text = get_detailed_geological_interpretation(mineral, results)
    
    elements.append(Paragraph(interpretation_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    return elements

def get_mineral_interpretation(mineral: str, results: AnalysisResults) -> str:
    """Get mineral-specific interpretation"""
    
    interpretations = {
        'gold': f"""
            The study area shows favorable conditions for gold mineralization. 
            Iron oxide ratio of {results.iron_oxide:.3f} indicates significant hematite/magnetite presence, 
            commonly associated with oxide zones above primary gold deposits. 
            Clay alteration index of {results.clay_index:.3f} suggests phyllosilicate alteration typical of 
            hydrothermal systems that host gold mineralization.
        """,
        'copper': f"""
            Copper prospectivity indicators are moderately favorable. 
            The iron oxide ratio ({results.iron_oxide:.3f}) suggests potential for copper oxide zones. 
            Strong hydrothermal signature ({results.hydrothermal:.3f}) indicates water-bearing alteration 
            minerals associated with porphyry copper systems.
        """,
        'lithium': f"""
            Lithium prospectivity assessment shows moderate potential. 
            The clay alteration index ({results.clay_index:.3f}) is particularly relevant for lithium, 
            which often occurs in clay and pegmatite deposits. 
            The hydrothermal index ({results.hydrothermal:.3f}) suggests suitable conditions for 
            lithium-bearing mineral occurrences.
        """,
        'rare_earths': f"""
            Rare earth element prospectivity indicators present an interesting exploration target. 
            The combined spectral signature with iron oxide ratio ({results.iron_oxide:.3f}) and 
            hydrothermal index ({results.hydrothermal:.3f}) is consistent with REE-bearing alkaline complexes 
            known in the region.
        """,
        'coal': f"""
            Coal prospectivity assessment indicates favorable sedimentary basin conditions. 
            The terrain analysis showing slope of {results.slope:.1f}° suggests gentle topography 
            conducive to coal seam preservation. Vegetation indices and drainage patterns 
            are consistent with paleodrainage systems that concentrate organic matter. 
            Clay alteration index of {results.clay_index:.3f} indicates carbonaceous shale associations 
            typical of coal-bearing sequences.
        """,
        'graphite': f"""
            Graphite exploration potential is indicated by metamorphic terrain signatures. 
            The clay alteration index ({results.clay_index:.3f}) suggests pelitic metamorphic rocks 
            which commonly host graphite mineralization. Iron oxide ratio ({results.iron_oxide:.3f}) 
            indicates associated iron formations and metamorphic facies. 
            Slope of {results.slope:.1f}° reflects mountain terrain with exposed metamorphic complexes.
        """
    }
    
    return interpretations.get(mineral.lower(), "Spectral analysis indicates prospective conditions for the target mineral.")

def get_detailed_geological_interpretation(mineral: str, results: AnalysisResults) -> str:
    """Get detailed geological interpretation"""
    
    interpretations = {
        'gold': f"""
            <b>Gold Mineralization Context:</b> The study area demonstrates multiple indicators favorable for 
            orogenic or porphyry gold systems. The iron oxide ratio of {results.iron_oxide:.3f} indicates oxidized 
            protolith or strong oxidation overprinting, typical of supergene enrichment zones. The hydrothermal 
            alteration index ({results.hydrothermal:.3f}) suggests water-rich alteration assemblages including 
            sericite and clay minerals characteristic of epithermal or deeper mesothermal gold systems. 
            Slope values of {results.slope:.1f}° suggest terrain suitable for structural control of mineralization.<br/><br/>
            The combined prospectivity score of {results.prospectivity_score:.1%} reflects moderate to strong 
            favorability for gold exploration drilling in the identified target zones.
        """,
        'copper': f"""
            <b>Copper Mineralization Indicators:</b> The spectral signature indicates favorable conditions for 
            copper-porphyry or volcanic-hosted copper systems. Iron oxide ratios ({results.iron_oxide:.3f}) 
            and clay alteration ({results.clay_index:.3f}) are consistent with advanced argillic and phyllic 
            alteration halos typical of porphyry copper deposits. The strong hydrothermal signature 
            ({results.hydrothermal:.3f}) suggests mature alteration systems suitable for copper accumulation.
        """,
        'lithium': f"""
            <b>Lithium Prospectivity Assessment:</b> The spectral signature shows features relevant to lithium 
            exploration. The elevated clay alteration index ({results.clay_index:.3f}) is particularly significant, 
            as lithium commonly occurs in clay-rich pegmatites and altered granitic rocks. The hydrothermal index 
            ({results.hydrothermal:.3f}) and relatively moderate topography (slope: {results.slope:.1f}°) 
            are consistent with conditions favorable for lithium mineralization preservation.
        """,
        'rare_earths': f"""
            <b>Rare Earth Element Prospectivity:</b> The analysis identifies terrain favorable for rare earth 
            element exploration. The iron oxide ratio ({results.iron_oxide:.3f}) and spectral signatures are 
            consistent with alkaline igneous complexes known to host REE deposits. The hydrothermal index 
            ({results.hydrothermal:.3f}) suggests moderate alteration, potentially representing 
            weathering and oxidation of primary REE-bearing phases.
        """,
        'coal': f"""
            <b>Coal Prospectivity Analysis:</b> The study area demonstrates favorable sedimentary basin characteristics 
            for coal deposition. The gentle terrain slope of {results.slope:.1f}° is typical of stable 
            intracratonic basins where coal accumulated. The identified vegetation and drainage patterns 
            (NDVI proxy: {results.hydrothermal:.3f}) indicate paleodrainage systems consistent with Gondwanan 
            coal-bearing sequences. Clay mineral associations ({results.clay_index:.3f}) suggest carbonaceous shale 
            and mudstone sequences intercalated with potential coal seams. The prospectivity score of {results.prospectivity_score:.1%} 
            indicates moderate to strong favorability for coal exploration in identified structural/stratigraphic settings.
        """,
        'graphite': f"""
            <b>Graphite Mineralization Context:</b> The spectral and terrain signatures identify metamorphic terrain 
            favorable for crystalline graphite deposits. The elevated clay alteration index ({results.clay_index:.3f}) 
            suggests pelitic metamorphic rocks (metamorphosed mudstones and shales) which are the primary host for 
            flake graphite. Iron oxide indicators ({results.iron_oxide:.3f}) reflect iron formations and metamorphic 
            facies associations. The terrain slope of {results.slope:.1f}° indicates mountain/highland terrain where 
            metamorphic complexes are exposed. Associated lineament density provides structural control indicators 
            for graphite concentration along metamorphic foliations. The prospectivity score of {results.prospectivity_score:.1%} 
            reflects favorable conditions for targeted graphite exploration drilling.
        """
    }
    
    return interpretations.get(mineral.lower(), "Geological interpretation pending mineral-specific analysis.")

def generate_pdf_report(
    output_filename: str,
    metadata: ReportMetadata,
    satellite: SatelliteData,
    results: AnalysisResults,
    boreholes: List[BoreholeRecommendation]
) -> str:
    """
    Generate complete PDF report
    
    Args:
        output_filename: Path to save PDF
        metadata: Report metadata
        satellite: Satellite data info
        results: Analysis results
        boreholes: Recommended borehole list
        
    Returns:
        Path to generated PDF
    """
    
    doc = create_styled_document(output_filename, metadata)
    
    # Build document elements
    story = []
    
    # Title page
    story.extend(create_title_page(metadata))
    
    # Satellite data section
    story.extend(create_satellite_data_section(satellite))
    
    # Analysis results section
    story.extend(create_analysis_results_section(results, metadata.mineral))
    
    # Borehole recommendations
    story.extend(create_borehole_recommendations_section(boreholes))
    
    # Geological interpretation
    story.extend(create_geological_interpretation_section(metadata.mineral, results))
    
    # Footer
    story.append(PageBreak())
    
    styles = getSampleStyleSheet()
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    
    story.append(Paragraph(
        f"Generated by Mandlakazi GeoProspector AI - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>"
        "This report contains proprietary analysis and mineral prospectivity assessments.",
        footer_style
    ))
    
    # Build PDF
    doc.build(story)
    
    print(f"OK PDF report generated: {output_filename}")
    return output_filename
