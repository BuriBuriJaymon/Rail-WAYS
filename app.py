import streamlit as st
from datetime import date
from main import TripPlannerWithPrices

# Page Configuration
st.set_page_config(
    page_title="Rail-WAYS Route & Price Optimizer",
    page_icon="🚆",
    layout="wide"
)

# Custom CSS for Off-White / Creamish Theme and Black Font
st.markdown("""
<style>
    .stApp {
        background-color: #fdfbf7;
        color: #000000;
    }
    section[data-testid="stSidebar"] {
        background-color: #f4efea;
    }
    h1, h2, h3, h4, h5, h6, p, span, label, div {
        color: #000000 !important;
    }
    .stButton>button {
        background-color: #111111;
        color: #ffffff !important;
        border-radius: 4px;
        font-weight: bold;
    }
    .stButton>button:hover {
        background-color: #333333;
        color: #ffffff !important;
    }
    table {
        color: #000000 !important;
        background-color: #ffffff !important;
    }
</style>
""", unsafe_allow_html=True)

st.title("🚆 Rail-WAYS: Journey & Price Optimizer")
st.markdown("Find optimal train routes and predicted ticket prices instantly.")

# Sidebar Inputs for User Journey
st.sidebar.header("Journey Parameters")
source_station = st.sidebar.text_input("Source Station Code", value="MMCT").upper()
dest_station = st.sidebar.text_input("Destination Station Code", value="NDLS").upper()
travel_date = st.sidebar.date_input("Travel Date", value=date(2026, 12, 13))

class_options = ['SL', '3A', '2A']
selected_classes = st.sidebar.multiselect(
    "Class Preferences", 
    options=class_options, 
    default=['SL', '3A', '2A'], 
    key="class_pref_clean_v5"
)

# Search Button
if st.sidebar.button("Find Trains & Predict Prices"):
    if not source_station or not dest_station:
        st.error("Please enter both source and destination station codes.")
    elif not selected_classes:
        st.warning("Please select at least one class preference.")
    else:
        with st.spinner("Searching routes and calculating prices..."):
            try:
                planner = TripPlannerWithPrices('.', "decision_tree_regression_balanced_price", selected_classes)
                direct_trains, indirect_trains = planner.query(source_station, dest_station, travel_date)
                
                st.subheader(f"Direct Trains from {source_station} to {dest_station}")
                if direct_trains is not None and not direct_trains.empty:
                    st.dataframe(direct_trains, use_container_width=True)
                else:
                    st.info("No direct trains found for this route and date.")

                st.subheader(f"Indirect (Connecting) Trains from {source_station} to {dest_station}")
                if indirect_trains is not None and not indirect_trains.empty:
                    st.dataframe(indirect_trains, use_container_width=True)
                else:
                    st.info("No indirect train itineraries found.")
                    
            except Exception as e:
                st.error(f"An error occurred during execution: {e}")