/**
 * Get friendly display name for a tool
 */
export function getToolDisplayName(tool: string): string {
  const nameMap: Record<string, string> = {
    // Home Assistant tools
    control_device: 'Controlling Device',
    set_climate: 'Setting Climate',
    activate_scene: 'Activating Scene',
    control_media: 'Controlling Media',
    control_cover: 'Adjusting Blinds',
    control_lock: 'Managing Lock',
    get_device_state: 'Checking State',
    discover_devices: 'Discovering Devices',
    control_alarm: 'Managing Alarm',
    get_sensor_state: 'Reading Sensor',
    get_sensor_history: 'Fetching History',
    trigger_automation: 'Running Automation',
    toggle_automation: 'Toggling Automation',
    run_script: 'Running Script',
    control_vacuum: 'Controlling Vacuum',
    get_energy_stats: 'Fetching Energy Data',
    send_notification: 'Sending Notification',

    // Image tools
    generate_image: 'Generating Image',
    edit_image: 'Editing Image',
    analyze_image: 'Analyzing Image',
    create_diagram: 'Creating Diagram',
    create_chart: 'Creating Chart',
    compare_images: 'Comparing Images',

    // Finance tools
    get_balance_sheet: 'Fetching Balances',
    get_spending_summary: 'Analyzing Spending',
    get_upcoming_bills: 'Checking Bills',
    find_subscriptions: 'Finding Subscriptions',
    can_i_afford: 'Checking Affordability',
    project_wealth: 'Projecting Wealth',
    get_transactions: 'Fetching Transactions',
    categorize_transaction: 'Categorizing',

    // Google tools
    gmail_list_messages: 'Searching Gmail',
    gmail_send_message: 'Sending Email',
    gmail_get_message: 'Reading Email',
    calendar_list_events: 'Checking Calendar',
    calendar_create_event: 'Creating Event',
    calendar_update_event: 'Updating Event',
    calendar_delete_event: 'Deleting Event',
    drive_search_files: 'Searching Drive',
    drive_get_file: 'Reading File',

    // GitHub tools
    github_search_code: 'Searching Code',
    github_get_file: 'Reading File',
    github_list_prs: 'Listing PRs',
    github_get_pr: 'Fetching PR',
    github_create_issue: 'Creating Issue',
    github_list_issues: 'Listing Issues',

    // Database tools
    supabase_run_sql: 'Running SQL',
    supabase_get_schema: 'Reading Schema',
    supabase_query: 'Querying Database',
    supabase_insert: 'Inserting Data',
    supabase_update: 'Updating Data',

    // Research tools
    web_search: 'Searching Web',
    perplexity_search: 'Researching',
    search_web: 'Web Search',

    // Memory tools
    recall_memories: 'Recalling Memory',
    store_memory: 'Storing Memory',
    search_memories: 'Searching Memory',

    // Utility tools
    get_current_datetime: 'Getting Time',
    get_weather: 'Checking Weather',
    calculate: 'Calculating',
  };

  return nameMap[tool] || tool.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
