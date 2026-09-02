"""
RiskSūtra — Abuse-Ring Sentinel (Graph Engine)

Constructs an entity graph across merchants, devices, IPs, sessions, and payment instruments.
Detects syndicate abuse clusters, multi-merchant device sharing, and compromised proxy rings.
"""

from collections import defaultdict
import uuid
from typing import Optional

from models.schemas import AbuseCluster, Event


class GraphService:
    """
    In-memory graph analytics engine for multi-entity risk mapping and syndicate discovery.
    """

    def __init__(self):
        # Node structures
        # entity_type:node_id -> set of connected (entity_type:node_id)
        self.adj = defaultdict(set)
        self.node_merchants = defaultdict(set)
        self.node_events = defaultdict(set)

    def add_event(self, event: Event):
        """Incorporate an event into the global entity graph."""
        m_node = f"MERCHANT:{event.merchant_id}"

        nodes = [m_node]

        if event.device_id:
            d_node = f"DEVICE:{event.device_id}"
            nodes.append(d_node)
            self.node_merchants[d_node].add(event.merchant_id)
            self.node_events[d_node].add(event.event_id)

        if event.ip_address:
            ip_node = f"IP:{event.ip_address}"
            nodes.append(ip_node)
            self.node_merchants[ip_node].add(event.merchant_id)
            self.node_events[ip_node].add(event.event_id)

        if event.session_id:
            s_node = f"SESSION:{event.session_id}"
            nodes.append(s_node)
            self.node_merchants[s_node].add(event.merchant_id)
            self.node_events[s_node].add(event.event_id)

        # Connect all nodes present in this event in a clique
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                u, v = nodes[i], nodes[j]
                self.adj[u].add(v)
                self.adj[v].add(u)

    def build_graph_from_events(self, events: list[Event]):
        """Populate graph from a collection of events."""
        for e in events:
            self.add_event(e)

    def detect_abuse_clusters(self, target_merchant_id: Optional[str] = None) -> list[AbuseCluster]:
        """
        Identify connected components where devices or IPs are shared across multiple merchants.
        """
        visited = set()
        clusters = []

        all_nodes = list(self.adj.keys())
        for start_node in all_nodes:
            if start_node in visited:
                continue

            # BFS / Connected Component
            component = []
            queue = [start_node]
            visited.add(start_node)

            shared_devices = 0
            shared_ips = 0
            merchants_involved = set()
            evidence_events = set()

            while queue:
                curr = queue.pop(0)
                component.append(curr)

                if curr.startswith("MERCHANT:"):
                    merchants_involved.add(curr.split(":", 1)[1])
                elif curr.startswith("DEVICE:"):
                    if len(self.node_merchants[curr]) > 1:
                        shared_devices += 1
                    evidence_events.update(self.node_events[curr])
                elif curr.startswith("IP:"):
                    if len(self.node_merchants[curr]) > 1:
                        shared_ips += 1
                    evidence_events.update(self.node_events[curr])

                for nxt in self.adj[curr]:
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)

            # Filter for multi-merchant involvement or high device sharing
            if len(merchants_involved) > 1 or shared_devices >= 2:
                if target_merchant_id and target_merchant_id not in merchants_involved:
                    continue

                # Calculate risk score for cluster
                m_count = len(merchants_involved)
                raw_score = min(1.0, 0.4 + (m_count - 1) * 0.25 + shared_devices * 0.15 + shared_ips * 0.05)

                cluster = AbuseCluster(
                    cluster_id=f"CLUS_{uuid.uuid4().hex[:10]}",
                    entity_count=len(component),
                    shared_devices=shared_devices,
                    shared_ips=shared_ips,
                    merchants_involved=sorted(list(merchants_involved)),
                    risk_score=round(raw_score, 4),
                    evidence_event_ids=sorted(list(evidence_events))[:50],
                )
                clusters.append(cluster)

        clusters.sort(key=lambda c: c.risk_score, reverse=True)
        return clusters

    def get_merchant_cluster(self, merchant_id: str) -> Optional[AbuseCluster]:
        """Get top abuse cluster for a specific merchant."""
        clusters = self.detect_abuse_clusters(target_merchant_id=merchant_id)
        return clusters[0] if clusters else None
